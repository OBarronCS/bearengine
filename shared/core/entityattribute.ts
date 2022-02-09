import { AbstractEntity, EntityID } from "./abstractentity";
import { getEntityIndex } from "./entitysystem";


export const ATTRIBUTE_ID_KEY = "ATTRIBUTE_ID";

export function get_attribute_id_from_type<K extends new(...args: any[]) => Attribute>(attr_constructor: K): number | -1 {
    const has_id = attr_constructor.hasOwnProperty(ATTRIBUTE_ID_KEY);

    if(has_id){
        return attr_constructor[ATTRIBUTE_ID_KEY];
    } else {
        return -1;
    }
}

export function get_attribute_id<K extends Attribute>(attr: K): number | -1 {
    return get_attribute_id_from_type(attr.constructor as any);
}

export abstract class Attribute {
    public owner: AbstractEntity;
}


export class AttributeContainer<T extends Attribute> {

    onAdd: ((part: T) => void)[] = [];
    onRemove: ((part: T) => void)[] = [];

    public sparse: number[]= [];
    public dense: T[] = [];


    addPart(part: T, sparseIndex: number){
        const indexInDense = this.dense.push(part) - 1;
        this.sparse[sparseIndex] = indexInDense;

        for(const onAdd of this.onAdd){
            onAdd(part);
        }
    }

    getEntityPart(e: EntityID): T | null {
        const sparseIndex = getEntityIndex(e);

        if(this.sparse.length <= sparseIndex) return null;

        const value = this.sparse[sparseIndex];

        if(value === -1 || value === undefined){
            return null;
        }

        return this.dense[getEntityIndex(value)];
    }

    contains(e: EntityID): boolean {
        const sparseIndex = getEntityIndex(e);

        if(this.sparse.length <= sparseIndex) return false;

        const value = this.sparse[sparseIndex];

        if(value === -1 || value === undefined){
            return false;
        }

        return true;
    }

    /** Remove entity at this sparse index. */
    removePart(sparseIndex: number){
        const denseIndex = this.sparse[sparseIndex];
        const part = this.dense[denseIndex];

        // Set the sparse to -1 to signify it's not here
        this.sparse[sparseIndex] = -1;
        
        // Edge case: removing the last part in the list.
        const lastIndex = this.dense.length - 1;
        if(denseIndex !== lastIndex){
            // swap this with last entity in dense
            this.dense[denseIndex] = this.dense[lastIndex];

            const swappedID = getEntityIndex(this.dense[denseIndex].owner.entityID);
            this.sparse[swappedID] = denseIndex;
        }

        this.dense.pop();

        for(const onRemove of this.onRemove){
            onRemove(part);
        }
    }
}

export class AttributeQuery<T extends Attribute>{
    
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
}




