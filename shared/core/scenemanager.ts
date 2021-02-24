import { AbstractEntity } from "./abstractentity";
import { TagPart, TagType } from "./abstractpart";
import { PartQuery } from "./partquery";
import { Subsystem } from "./subsystem";



// TODO: get entity/part by id, efficiently.
// Prefereablty O(1)
// Also, get entities by some sort of unique tag
// Be able to just query for the player object

// Holds all the entities and keeps track of their parts
// Essentially, a scene of entities
export class Scene extends Subsystem {

    private updateList: AbstractEntity[] = [];
    private partQueries: PartQuery<any>[] = [];

    private tags: PartQuery<TagPart>;

    init(): void {
        this.tags = new PartQuery(TagPart);
        this.partQueries.push(this.tags)
    }

    update(delta: number): void {
        for (let i = 0; i < this.updateList.length; i++) {
            const entity = this.updateList[i];
            entity.update(delta);
            entity.postUpdate(); // Maybe get rid of this, swap it with systems that I call after step
        }
    }

    registerPartQueries(systems: Subsystem[]){
        for(const system of systems){
            this.partQueries.push(...system.queries);
        }
    }

    clear(){
        this.updateList.forEach( e => {
            e.onDestroy();

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            })
        })

        this.updateList = [];

        this.partQueries = [];
    }


    destroyEntity<T extends AbstractEntity>(e: T): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            e.onDestroy();
            this.updateList.splice(index,1);

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            });
        }
    }

    addEntity<T extends AbstractEntity>(e: T): T {
        this.updateList.push(e);
        e.onAdd();

        this.partQueries.forEach(q => {
            q.addEntity(e)
        });

        return e;
    }


    getEntityByTag<T extends AbstractEntity>(tag: TagType): T {
        for(const tagPart of this.tags){
            if(tagPart.name === tag){
                return <T>tagPart.owner;
            }
        }
        console.log("COULD NOT FIND ENTITY BY TAG: " + tag)
        return null;
    }
}




