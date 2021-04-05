import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { Part, PartContainer, TagPart, TagType } from "shared/core/abstractpart";
import { PartQuery } from "shared/core/abstractpart";
import { Subsystem } from "shared/core/subsystem";
import { EntityEventListType } from "shared/core/bearevents";


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
const MASK_TO_GET_VERSION_BITS = ((1 << BITS_FOR_VERSION) - 1) << BITS_FOR_INDEX;  

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


export class Scene<EntityType extends AbstractEntity = AbstractEntity> extends Subsystem {
    
    private partQueries: PartQuery<Part>[] = [];

    private nextPartID = 0;
    private partContainers: PartContainer<Part>[] = []

    // It finds this when iterating all the other systems.
    private tags: PartQuery<TagPart> = this.addQuery(TagPart);

    // Set of entities
    private freeID = NULL_ENTITY_INDEX; 
    private sparse: number[] = [];
    public entities: EntityType[] = [];

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

    addEntity<T extends EntityType>(e: T): T {

        const entityID: EntityID = this.getNextEntityID();
        //@ts-expect-error --> This is the only time we should be changing it
        e.entityID = entityID;

        const sparseIndex = getEntityIndex(entityID);
        const indexInDense = this.entities.push(e) - 1;

        this.sparse[sparseIndex] = indexInDense | (entityID & MASK_TO_GET_VERSION_BITS);

        e.onAdd();
        this.registerEvents(e);

        for(const part of e.parts){
            
            let uniquePartID = part.constructor["partID"];

            // First time adding this type of part
            if(uniquePartID === -1){
                uniquePartID = part.constructor["partID"] = this.nextPartID++;

                const container = new PartContainer();
                this.partContainers.push(container);

                const name = part.constructor.name;
                for(const query of this.partQueries){
                    
                    if(query.name === name){
                        container.onAdd.push(query.onAdd);
                        container.onRemove.push(query.onRemove);

                        query.parts = container.dense;
                    }
                }
            }

            const container = this.partContainers[uniquePartID];
            container.addPart(part, sparseIndex);
        }

        return e;
    }

    /** Null if entity has already been deleted */
    getEntity<T extends EntityType = EntityType>(entityID: EntityID): T | null {
        const sparseIndex = getEntityIndex(entityID);
        const version = getEntityVersion(entityID); 
        
        if(getEntityVersion(this.sparse[sparseIndex]) !== version) {
            // This is fairly common
            // console.log("Trying to delete something that has already been deleted");
            return null;
        }
        
        const denseIndex = getEntityIndex(this.sparse[sparseIndex]);
        const entity = this.entities[denseIndex];
        return (entity as T);         
    }

    /** Queues the destroyal of an entity, end of scene system tick */
    public destroyEntity<T extends EntityType>(e: T): void {
        this.destroyEntityID(e.entityID);
    }

    /** Queues the destroyal of an entity, end of scene system tick */
    public destroyEntityID(id: EntityID): void {
        this.deleteEntityQueue.push(id);
    }

    private destroyEntityImmediately(entityID: EntityID){
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
            const container = this.partContainers[part.constructor["partID"]]
            container.removePart(sparseIndex);
        }
        
        entity.onDestroy();
    }



    init(): void {}
    update(delta: number): void {

        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            entity.update(delta);
            entity.postUpdate(); // Maybe get rid of this, swap it with systems that I call after step
        }

        for(const id of this.deleteEntityQueue){
            this.destroyEntityImmediately(id);
        }

        if(this.deleteEntityQueue.length > 0) this.deleteEntityQueue = [];
    }

    registerPartQueries(systems: Subsystem[]){
        for(const system of systems){
            this.partQueries.push(...system.queries);
        }
    }

    clear(){
        this.entities.forEach( e => {
            e.onDestroy();

            for(const part of e.parts){
                const container = this.partContainers[part.constructor["partID"]]
                container.removePart(e.entityID);
            }
        });
    
        // Keep that part containers as they are, really no point in resetting them.

        this.freeID = NULL_ENTITY_INDEX;
        this.sparse = [];
        this.entities = [];

        this.partQueries = [];
    }


    private registerEvents<T extends EntityType>(e: T): void {
        if(e.constructor["EVENT_REGISTRY"]){
            const list = e.constructor["EVENT_REGISTRY"] as EntityEventListType<T>;

            for(const item of list){
                const handler = this.engine.systemEventMap.get(item.eventname);
                if(!handler) {
                    console.log(`Handler for ${item.eventname} could not be found!`)
                }

                const methodName = item.methodname;

                handler.addListener(e, methodName, item.extradata)
            }
        }
    }

    getEntityByTag<T extends EntityType>(tag: TagType): T {
        for(const tagPart of this.tags){
            if(tagPart.name === tag){
                return <T>tagPart.owner;
            }
        }
        console.log("COULD NOT FIND ENTITY BY TAG: " + tag)
        return null;
    }
}




