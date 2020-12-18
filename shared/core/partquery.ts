
import { SpritePart } from "client/src/app/core-engine/parts";
import { AbstractEntity } from "./abstractentity";
import { Part } from "./abstractpart";


// Can be used by various game systems to listen for entities that are created that have a certain part
// uses constructor.name to identify them

export class PartQuery<T extends Part>{
    public name: string;

    //public parts: T[]
    //public partSet = new Set<T>();

    onAdd: (part: T) => void;
    onRemove: (part: T) => void;

    constructor(
            partClass: new(...args:any[]) => T,
            onAdd: (part: T) => void,
            onRemove: (part: T) => void
        ){
        this.name = partClass.name;
        this.onAdd = onAdd;
        this.onRemove = onRemove;
    }


    addEntity(e: AbstractEntity){
        for(const p of e.parts){
            if(p.constructor.name === this.name){
                this.onAdd(p as T);
                return;
            }
        }  
    }

    // We are deleting an entity. Check if that entity had the part this query cared about
    deleteEntity(e: AbstractEntity){
        for(const p of e.parts){
            if(p.constructor.name === this.name){

                this.onRemove(p as T);
                return;
            }
        }  
    }

    

}




