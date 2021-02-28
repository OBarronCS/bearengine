
import { AbstractEntity } from "shared/core/abstractentity";
import { TagPart, TagType } from "shared/core/abstractpart";
import { PartQuery } from "shared/core/partquery";
import { Subsystem } from "shared/core/subsystem";
import { BearEngine } from "./bearengine";
import { EntityEventListType } from "shared/core/bearevents";


export class ClientScene extends Subsystem<BearEngine> {

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

    private registerEvents<T extends AbstractEntity>(e: T): void {
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

    addEntity<T extends AbstractEntity>(e: T): T {
        this.updateList.push(e);
        e.onAdd();

        this.registerEvents(e);

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




