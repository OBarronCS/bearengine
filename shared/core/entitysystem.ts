import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { Attribute, AttributeContainer, ATTRIBUTE_ID_KEY, get_attribute_id, get_attribute_id_from_type } from "shared/core/entityattribute";
import { AttributeQuery } from "shared/core/entityattribute";
import { Subsystem } from "shared/core/subsystem";
import { EntityEventListType, EventRegistry } from "shared/core/bearevents";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { assert } from "shared/misc/assertstatements";
import { BearEvents } from "./sharedlogic/eventdefinitions";
import { SparseSet } from "shared/datastructures/sparseset";


export interface IEntityScene<TEntity extends AbstractEntity = AbstractEntity> {
    entities: readonly TEntity[],
    hasAttribute<K extends new(...args: any[]) => Attribute>(e: EntityID, partConstructor: K): boolean,
    getAttribute<K extends new(...args: any[]) => Attribute, T extends InstanceType<K>>(e: EntityID, partConstructor: K): T | null
    addEntity<T extends TEntity>(e: T): T,
    getEntity<T extends TEntity = TEntity>(entityID: EntityID): T | null,
    destroyEntity<T extends TEntity>(e: T): void,
    destroyEntityID(id: EntityID): void
}


// Most significant 8 bits are version number, unsigned int --> [0,255], wraps 
// least significant 24 bits are sparse index, unsigned int --> means max 16,777,215 entities 
const BITS_FOR_INDEX = 24;
/**  EntityID & MASK_TO_EXTRACT_INDEX = sparse_index */
const MASK_TO_EXTRACT_INDEX = (1 << BITS_FOR_INDEX) - 1;

export function getEntityIndex(id: EntityID): number {
    return id & MASK_TO_EXTRACT_INDEX;
}

export const NULL_ENTITY_INDEX = MASK_TO_EXTRACT_INDEX;

const BITS_FOR_VERSION = 8; 
const MAX_VERSION_NUMBER = (1 << BITS_FOR_VERSION) - 1;

/** const onlyVBits = EntityID & MASK_TO_GET_VERSION_BITS --> Only version bits left in 32 bit integer */
export const MASK_TO_GET_VERSION_BITS = ((1 << BITS_FOR_VERSION) - 1) << BITS_FOR_INDEX;  

export function getEntityVersion(id: EntityID): number { 
    // Because bitwise operations in JavaScript turn numbers into SIGNED 32 bits integers, need triple > to stop the sign bit from propagating
    return id >>> BITS_FOR_INDEX;
}

function entityIDFromIndexAndVersion(sparse_index: number, version: number){
    return sparse_index | (version << BITS_FOR_INDEX);
}

// Prints out the bits in an entity id, for debugging
function entityToString(id: EntityID){
    let str = "";
    for(let i = 0; i < 32; i++){
        str += !!(id & (1 << (31 - i))) ? "1": "0";
    }
    return str
}

export function StreamWriteEntityID(stream: BufferStreamWriter, entityID: EntityID): void {
    // const indexNumber = getEntityIndex(entityID);

    // // Ensure that it fits in 16 bits
    // assert(indexNumber <= ( (1 << 16) - 1), "Entity index to large to send over network!");
    
    // stream.setUint16(indexNumber);

    // Make sure it fits in 32 bits
    // assert(entityID <= (2**32) - 1);
    stream.setUint32(entityID);
}

export function StreamReadEntityID(stream: BufferStreamReader): number {
    // return stream.getUint16();
    return stream.getUint32();
}

export class EntitySystem<TEntity extends AbstractEntity = AbstractEntity> extends Subsystem implements IEntityScene<TEntity> {
    
    private partQueries: AttributeQuery<Attribute>[] = [];
    private allEntityEventHandlers: Map<keyof BearEvents, EventRegistry<keyof BearEvents>> = new Map();;
    private subsets: EntitySystemSubset<this>[] = [];


    private nextPartID = 0;
    private partContainers: AttributeContainer<Attribute>[] = []

    // It finds these when iterating all the other systems.
    private preupdate = this.addEventDispatcher("preupdate");
    private postupdate = this.addEventDispatcher("postupdate");


    // Set of entities
    private freeID = NULL_ENTITY_INDEX; 
    private sparse: number[] = [];
    public entities: TEntity[] = [];

    private deleteEntityQueue: EntityID[] = [];

    private getNextEntityID(): EntityID {
        // If this is true there are no sparse indices to re-use. Version number implicitly 0
        if(this.freeID === NULL_ENTITY_INDEX){
            return this.sparse.length;
        } else { 
            // freeID refers to a hole
            const sparseIndex = this.freeID;

            const linkedlistID = this.sparse[sparseIndex];

            const entityID = entityIDFromIndexAndVersion(this.freeID, getEntityVersion(linkedlistID)); 

            // Moves the linked list up one;
            this.freeID = getEntityIndex(linkedlistID);

            return entityID;
        }
    }

    private isValidEntity(id: EntityID): boolean {
        const sparseIndex = getEntityIndex(id);

        if(this.sparse.length <= sparseIndex) return false;

        return getEntityVersion(this.sparse[sparseIndex]) === getEntityVersion(id);
    }

    view<K extends new(...args: any[]) => Attribute>(attr_constructor: K): readonly InstanceType<K>[] {
        const attr_id = get_attribute_id_from_type(attr_constructor);

        if(attr_id === -1) return [];
        
        //@ts-expect-error
        const container: AttributeContainer<InstanceType<K>> = this.partContainers[attr_id];
        return container.dense;
    }

    hasAttribute<K extends new(...args: any[]) => Attribute>(e: EntityID, attr_constructor: K): boolean {

        if(!this.isValidEntity(e)) throw new Error("Entity dead") ;

        const attr_id = get_attribute_id_from_type(attr_constructor);

        if(attr_id === -1) return false;
        
        const container = this.partContainers[attr_id];
        return container.contains(e);
    }

    getAttribute<K extends new(...args: any[]) => Attribute, T extends InstanceType<K>>(e: EntityID, attr_constructor: K): T | null {

        if(!this.isValidEntity(e)) throw new Error("Entity dead") ;
        
        const attr_id = get_attribute_id_from_type(attr_constructor);

        if(attr_id === -1) return null;
        
        ///@ts-expect-error
        const container: AttributeContainer<T> = this.partContainers[attr_id];
        return container.getEntityPart(e);
    }

    private register_new_attribute_type(attr_constructor: typeof Attribute): number {
        // console.log("Adding for the first time: " + part.constructor.name);
        const unique_attr_id = attr_constructor[ATTRIBUTE_ID_KEY] = this.nextPartID++;
                
        const name = attr_constructor.name;

        const container = new AttributeContainer();
        this.partContainers.push(container);

        // console.log(this.partQueries);
        for(const query of this.partQueries){
            // console.log("Query name: " + query.name)

            if(query.name === name){
                // console.log("Adding to query")
                container.onAdd.push(query.onAdd);
                container.onRemove.push(query.onRemove);

                query.parts = container.dense;
            }
        }

        return unique_attr_id;
    }

    addEntity<T extends TEntity>(e: T): T {

        if(e.entityID !== NULL_ENTITY_INDEX) {
            console.log("trying to add the same entity twice;");
            return e;
        }

        // Add entity to update list
        const entityID: EntityID = this.getNextEntityID();
        //@ts-expect-error --> This is the only time we should be changing it
        e.entityID = entityID;

        const sparseIndex = getEntityIndex(entityID);
        const indexInDense = this.entities.push(e) - 1;

        this.sparse[sparseIndex] = indexInDense | (entityID & MASK_TO_GET_VERSION_BITS);

        //@ts-expect-error --> Type error with covariance and contravariance. The entity could insert superclasses of TEntity with addEntity(),
        //Not worried about that right now
        e.scene = this;

        //Register entity;

        let e_type_id = get_attribute_id(e);
        if(e_type_id === -1){
            e_type_id = this.register_new_attribute_type(e.constructor as typeof Attribute);
        }

        const e_container = this.partContainers[e_type_id];
        e_container.addPart(e, sparseIndex);

        e.onAdd();

        this.registerEvents(e, sparseIndex);

        // Register parts
        for(const part of e.parts){
            //@ts-expect-error
            if(this.hasAttribute(entityID, part.constructor)) throw Error("Entity already has this part: " + part.constructor.name + " --> " + e.constructor.name);
            
            let unique_attr_id = get_attribute_id(part);

            // First time adding this type of part
            if(unique_attr_id === -1){
                unique_attr_id = this.register_new_attribute_type(part.constructor as typeof Attribute);
            }

            const container = this.partContainers[unique_attr_id];
            container.addPart(part, sparseIndex);
        }

        return e;
    }

    private registerEvents<T extends TEntity>(e: T, sparseIndex: number): void {

        // console.log(e, e.constructor["EVENT_REGISTRY"]);

        if(e.constructor["EVENT_REGISTRY"]){
            const list = e.constructor["EVENT_REGISTRY"] as EntityEventListType<T>;

            for(const item of list){
                const handler = this.allEntityEventHandlers.get(item.eventname);
                if(!handler) {
                    console.error(`Handler for ${item.eventname} could not be found!`)
                }

                const methodName = item.methodname;
                handler.addListener(e, methodName, item.extradata, sparseIndex);
            }
        }
    }

    private deleteEvents<T extends TEntity>(e: T, sparseIndex: number){
        if(e.constructor["EVENT_REGISTRY"]){
            const list = e.constructor["EVENT_REGISTRY"] as EntityEventListType<T>;

            for(const item of list){
                const handler = this.allEntityEventHandlers.get(item.eventname);
                if(!handler) {
                    console.log(`Handler for ${item.eventname} could not be found!`)
                }

                handler.removeListener(sparseIndex);
            }
        }
    }

    /** Null if entity has already been deleted */
    getEntity<T extends TEntity = TEntity>(entityID: EntityID): T | null {
        const sparseIndex = getEntityIndex(entityID);
        const version = getEntityVersion(entityID); 
        
        if(getEntityVersion(this.sparse[sparseIndex]) !== version) {
            return null;
        }
        
        const denseIndex = getEntityIndex(this.sparse[sparseIndex]);
        const entity = this.entities[denseIndex];
        return (entity as T);         
    }

    /** Queues the destroyal of an entity, end of scene system tick */
    destroyEntity<T extends TEntity>(e: T): void {
        this.destroyEntityID(e.entityID);
    }

    /** Queues the destroyal of an entity, end of scene system tick */
    destroyEntityID(id: EntityID): void {
        this.deleteEntityQueue.push(id);
    }

    destroyAllExcept(entities: TEntity[]){

        const eSet = new Set(entities.map(e => e.entityID));

        for(const entity of this.entities){
            if(!eSet.has(entity.entityID)){
                this.destroyEntityID(entity.entityID);
            }
        }
    }

    private destroyEntityImmediately(entityID: EntityID){
        if(entityID === NULL_ENTITY_INDEX){
            console.log("TRYING TO DELETE NULL ENTITY");
            return;
        }

        const sparseIndex = getEntityIndex(entityID);
        const version = getEntityVersion(entityID); 
        
        if(getEntityVersion(this.sparse[sparseIndex]) !== version) {
            // This is fairly common
            // console.log("Trying to delete something that has already been deleted");
            return;
        }

        const denseIndex = getEntityIndex(this.sparse[sparseIndex]);
        const entity = this.entities[denseIndex];

        if(denseIndex !== this.entities.length - 1){
            // Makes sure dense indices point to correct places
            this.entities[denseIndex] = this.entities[this.entities.length - 1];

            const entityIDOfSwapped = this.entities[denseIndex].entityID;
            
            const sparseIndexOfSwappedEntity = getEntityIndex(entityIDOfSwapped);

            this.sparse[sparseIndexOfSwappedEntity] = denseIndex | (entityIDOfSwapped & MASK_TO_GET_VERSION_BITS);
        }

        this.entities.pop();

        // Set free linked list 
        this.sparse[sparseIndex] = entityIDFromIndexAndVersion(this.freeID,(version + 1) & MAX_VERSION_NUMBER);
        this.freeID = sparseIndex;

        for(const part of entity.parts){
            const container = this.partContainers[get_attribute_id(part)]
            container.removePart(sparseIndex);
        }

        this.deleteEvents(entity,sparseIndex);
        
        entity.onDestroy();

        //@ts-expect-error
        entity.entityID = NULL_ENTITY_INDEX;
    }

    registerSystems(systems: Subsystem[]){

        for(const system of systems){
            this.partQueries.push(...system.queries);

            for(const handler of system.eventHandlers){
                this.allEntityEventHandlers.set(handler.eventName, handler);
            }
        }
        
    }

    init(): void {}

    update(delta: number): void {

        // Pre-update
        for(const entity of this.preupdate){
            this.preupdate.dispatch(entity, delta);
        }

        // Update
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            entity.update(delta);
        }

        // Post-update
        for(const entity of this.postupdate){
            this.postupdate.dispatch(entity, delta);
        }

        for(const id of this.deleteEntityQueue){
            this.destroyEntityImmediately(id);
        }

        if(this.deleteEntityQueue.length > 0) this.deleteEntityQueue = [];

        for(const s of this.subsets) s.process_delete_queue();
    }

    
    //  Does not clear queries
    clear(){

        const entityCopy = this.entities.slice(0);

        for(const e of entityCopy){
            this.destroyEntityImmediately(e.entityID);
        }

        // for(const id of this.deleteEntityQueue){
        //     this.destroyEntityImmediately(id);
        // }
        this.deleteEntityQueue = [];
        
        this.freeID = NULL_ENTITY_INDEX;
        this.sparse = [];
        this.entities = [];

        // Does it afterwards to clear all internally held entities
        for(const sub of this.subsets){
            sub.force_clear_subset();
        }
    }

    createSubset<T extends EntitySystemEntityType<this>>(): EntitySystemSubset<this,T> {


        const subset = new EntitySystemSubset<this,T>(this);

        this.subsets.push(subset);


        return subset;
    }
}







type EntitySystemEntityType<T> = T extends EntitySystem<infer R> ? R : never; 

class EntitySystemSubset<TSystem extends EntitySystem<AbstractEntity>, TEntity extends EntitySystemEntityType<TSystem> = EntitySystemEntityType<TSystem>> implements IEntityScene<TEntity>{

    private parentEntitySystem: TSystem;
    private subset: SparseSet<TEntity> = new SparseSet<TEntity>();
    
    private deleteEntityQueue: EntityID[] = [];

    get entities(): readonly TEntity[] {
        return this.subset.values();
    }

    constructor(system: TSystem){
        this.parentEntitySystem = system;
    }


    view<K extends new(...args: any[]) => Attribute>(partConstructor: K): readonly InstanceType<K>[] {
        return this.parentEntitySystem.view(partConstructor);
    }

    hasAttribute<K extends new(...args: any[]) => Attribute>(e: EntityID, partConstructor: K): boolean {
        return this.parentEntitySystem.hasAttribute(e, partConstructor);
    }

    getAttribute<K extends new(...args: any[]) => Attribute, T extends InstanceType<K>>(e: EntityID, partConstructor: K): T | null {
        return this.parentEntitySystem.getAttribute(e, partConstructor);
    }

    forceAddEntityFromMain<T extends TEntity>(e: T) {
        this.subset.set(e.entityID, e);
        
        //@ts-expect-error
        e.scene = this
    }

    addEntity<T extends TEntity>(e: T): T {
        if(e.entityID !== NULL_ENTITY_INDEX) {
            console.log("trying to add the same entity twice;")
            return e;
        }

        this.parentEntitySystem.addEntity(e);

        this.subset.set(e.entityID, e);
    
        //@ts-expect-error
        e.scene = this

        return e;
    }

    process_delete_queue(){
        for(const id of this.deleteEntityQueue){
            if(this.subset.contains(id)){
                this.subset.remove(id);
            } else {
                console.log("Trying to delete from subset when we don't have it")
            }
        }

        if(this.deleteEntityQueue.length > 0) this.deleteEntityQueue = [];
    }

    /** Null if entity has already been deleted */
    getEntity<T extends TEntity = TEntity>(entityID: EntityID): T | null {
        return this.parentEntitySystem.getEntity(entityID);
    }

    /** Queues the destroyal of an entity, end of scene system tick */
    destroyEntity<T extends TEntity>(e: T): void {
        this.destroyEntityID(e.entityID);
    }
    
    /** Queues the destroyal of an entity, end of scene system tick */
    destroyEntityID(id: EntityID): void {
        this.deleteEntityQueue.push(id);
        this.parentEntitySystem.destroyEntityID(id);
    }


    clear(){
        for(const e of this.subset.values()){
            this.parentEntitySystem.destroyEntityID(e.entityID);
        }

        this.subset.clear();
    }

    force_clear_subset(){
        this.subset.clear();
    }

}


