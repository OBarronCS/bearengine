import { Part } from "./abstractpart";
import { PartQuery } from "./partquery";


export abstract class Subsystem {
    queries: PartQuery<any>[] = [];
    
    addQuery<T extends Part>(
            partClass: new(...args:any[]) => T,
            onAdd: (part: T) => void = (a) => {},
            onRemove: (part: T) => void = (a) => {},
        ){

        const q = new PartQuery(partClass,onAdd,onRemove);
        this.queries.push(q)
        return q;
    }
}


