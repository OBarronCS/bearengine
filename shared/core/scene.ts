
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { Part, TagPart, TagType } from "shared/core/abstractpart";
import { PartQuery } from "shared/core/partquery";
import { Subsystem } from "shared/core/subsystem";
import { EntityEventListType } from "shared/core/bearevents";

export class Scene<EntityType extends AbstractEntity = AbstractEntity> extends Subsystem {
    
    private partQueries: PartQuery<Part>[] = [];

    // It finds this when iterating all the other systems.
    private tags: PartQuery<TagPart> = this.addQuery(TagPart);

    // Set of entities
    private freeID = -1;

    private sparse: number[] = [];
    public entities: EntityType[] = [];


    addEntity<T extends EntityType>(e: T): T {
        const id = this.getNextID();
        //@ts-expect-error --> This is a readonly property. This is the only time we should be changing it
        e.entityID = id;

        const indexInDense = this.entities.push(e) - 1;
        this.sparse[id] = indexInDense;

        e.onAdd();
        this.registerEvents(e);
        this.partQueries.forEach(q => {
            q.addEntity(e)
        });


        // console.log("Sparse: ", this.sparse);
        // console.log("Dense: ", this.entities);

        return e;
    }

    private getNextID(): EntityID {
        if(this.freeID === -1){
            return this.sparse.length;
        } else { // freeID refers to a hole
            const id = this.freeID;
            this.freeID = this.sparse[id];

            return id;
        }
    }

    getEntity<T extends EntityType = EntityType>(id: number): T {
        const entity = this.entities[this.sparse[id]];
        return (entity as T);         
    }

    destroyEntityByID(id: number): void {
        const denseIndex = this.sparse[id];
        const entity = this.entities[denseIndex];
        // Set the free list
        
        if(this.freeID === -1){
            this.freeID = id;
            this.sparse[id] = -1;
        } else {
            // freeID is referring to a hole
            this.sparse[id] = this.freeID;
            this.freeID = id;
        }


        // swap this last entity in dense
        this.entities[denseIndex] = this.entities[this.entities.length - 1];
        
        // Set the sparse array to point at the right one;
        const swappedID = this.entities[denseIndex].entityID;
        this.sparse[swappedID] = denseIndex;

        // Delete the last one; 
        this.entities.pop();

        entity.onDestroy();
        this.partQueries.forEach(q => {
            q.deleteEntity(entity)
        });
    }

    destroyEntity<T extends EntityType>(e: T): void {
        // FOR NOW: Assume the entity is alive. Definitely implement a check later
        //
        const id = e.entityID;

        const denseIndex = this.sparse[id];
        const entity = this.entities[denseIndex];
        if(entity === e) { 
            console.log("TRYING TO DELETE AN ENTITY THAT DOESN'T EXIST ANYMORE");
            return;
        }

        this.destroyEntityByID(id);
    }

    init(): void {}

    update(delta: number): void {

        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            entity.update(delta);
            entity.postUpdate(); // Maybe get rid of this, swap it with systems that I call after step
        }

        // Delete all entities that need to be deleted 
    }

    registerPartQueries(systems: Subsystem[]){
        for(const system of systems){
            this.partQueries.push(...system.queries);
        }
    }

    clear(){
        this.entities.forEach( e => {
            e.onDestroy();

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            })
        })

        this.freeID = -1;
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
                console.log("Handler: " + handler);

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




