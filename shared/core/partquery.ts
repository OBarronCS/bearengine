
import { AbstractEntity } from "./abstractentity";
import { Part } from "./abstractpart";


export class PartQuery<T extends Part>{
    
    public parts: T[] = [];
    
    name: string;
    onAdd: (part: T) => void;
    onRemove: (part: T) => void;

    constructor(
            partClass: new(...args:any[]) => T,
            onAdd: (part: T) => void = (a) => {},
            onRemove: (part: T) => void = (a) => {}
        ){
        this.name = partClass.name;
        this.onAdd = onAdd;
        this.onRemove = onRemove;
    }

    [Symbol.iterator](): Iterator<T> {
        return this.parts[Symbol.iterator]();
    }

    addEntity(e: AbstractEntity){
        for(const p of e.parts){
            if(p.constructor.name === this.name){
                this.onAdd(p as T);
                this.parts.push(p as T);
                return;
            }
        }  
    }

    // We are deleting an entity. Check if that entity had the part this query cared about
    deleteEntity(e: AbstractEntity){
        for(const p of e.parts){
            if(p.constructor.name === this.name){
                
                const i = this.parts.indexOf(p as T);
                if(i !== -1){
                    // This should always run... But just in case I check
                    // TODO: if this becomes a performance issue, create a sparse set
                    this.parts.splice(i,1);
                } else {
                    console.error("Part query didn't find part to delete, but it should contain it")
                }

                this.onRemove(p as T);
                return;
            }
        }  
    }

}




