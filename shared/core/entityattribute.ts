import { SparseSet } from "shared/datastructures/sparseset";
import { AbstractEntity } from "./abstractentity";


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

export function attribute_is_type<K extends new(...args: any[]) => Attribute>(attr: Attribute, attr_constructor: K): attr is InstanceType<K> {
    const attr_id = get_attribute_id(attr)
    const test_type = get_attribute_id_from_type(attr_constructor);

    if(attr_id !== -1){ // && test_type !== -1 is unnecessary
        return attr_id === test_type;
    } else {
        return false;
    }
}



export abstract class Attribute {
    public owner: AbstractEntity;
}


// Make sure to pass in the sparse index / entity index of the entity only! Aka the bottom 24 bits
export class AttributeContainer<T extends Attribute> {

    onAdd: ((attr: T) => void)[] = [];
    onRemove: ((attr: T) => void)[] = [];

    private attributes = new SparseSet<T>();

    get_attributes(): readonly T[] {
        return this.attributes.values();
    }

    add_attribute(sparse_index: number, attr: T): void {
        this.attributes.set(sparse_index, attr);

        for(const onAdd of this.onAdd){
            onAdd(attr);
        }
    }
    
    remove_attribute(sparse_index: number):void {
        const attr = this.attributes.get(sparse_index);
        this.attributes.remove(sparse_index);

        for(const onRemove of this.onRemove){
            onRemove(attr);
        }
    }

    get_attribute(sparse_index: number): T | null {
        return this.attributes.get(sparse_index);
    }

    contains(sparse_index: number): boolean {
        return this.attributes.contains(sparse_index);
    }
}

export class AttributeQuery<T extends Attribute>{
    
    public parts: readonly T[] = [];
    
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




