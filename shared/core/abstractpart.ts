




/*
// IN FUTURE: maybe make this a generic class, that is subclassed by server and client both, so the owner
// type can be the specific type that 

class A<T> {
    type: T
}

class B extends A<specific abstract entity> {

}
*/

import { AbstractEntity } from "./abstractentity";

export abstract class Part {
    public owner: AbstractEntity 

    abstract onAdd(): void;
    abstract onRemove(): void;
    abstract update(dt: number): void;
}


