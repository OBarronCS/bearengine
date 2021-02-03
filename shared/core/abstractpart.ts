

import { AbstractEntity } from "./abstractentity";

export abstract class Part {
    public owner: AbstractEntity;
    
    abstract onAdd(): void;
    abstract onRemove(): void;
    abstract update(dt: number): void;
}


