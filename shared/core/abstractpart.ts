import { AbstractEntity, EntityID } from "./abstractentity";
import { Rect, Dimension } from "shared/shapes/rectangle";
import { Coordinate } from "shared/shapes/vec2";

export abstract class Part {
    public static partID = -1; 
    public owner: AbstractEntity;
}


export class PartContainer<T extends Part> {

    onAdd: ((part: T) => void)[] = [];
    onRemove: ((part: T) => void)[] = [];

    public sparse: number[]= [];
    public dense: T[] = [];


    addPart(part: T, entityID: EntityID){
        const indexInDense = this.dense.push(part) - 1;
        this.sparse[entityID] = indexInDense;

        for(const onAdd of this.onAdd){
            onAdd(part);
        }
    }

    removePart(entityID: EntityID){
        const denseIndex = this.sparse[entityID];
        const part = this.dense[denseIndex];

        // Set the sparse to -1 to signify it's not here
        this.sparse[entityID] = -1;
        
        // Edge case: removing the last part in the list.
        const lastIndex = this.dense.length - 1;
        if(denseIndex !== lastIndex){
            // swap this with last entity in dense
            this.dense[denseIndex] = this.dense[lastIndex];

            const swappedID = this.dense[denseIndex].owner.entityID;
            this.sparse[swappedID] = denseIndex;
        }

        this.dense.pop();

        for(const onRemove of this.onRemove){
            onRemove(part);
        }
    }
}

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
}




// Add tag here to maintain type safety.
// These are expected to be UNIQUE to one entity
// So not a great long term solution
const tags = [
    "Player",
] as const

export type TagType = typeof tags[number]

export class TagPart extends Part {
    public name: TagType;
    constructor(name: TagType){
        super();
        this.name = name;
    }
}

export class ColliderPart extends Part {

    public rect: Rect;
    //* Where on the rectangle is the position */
    public offset: Coordinate;

    constructor(dimensions: Dimension,offset: Coordinate){
        super();
        this.rect = new Rect(0,0,dimensions.width, dimensions.height);
        this.offset = {x: 0, y:0};
        this.offset.x = -offset.x;
        this.offset.y = -offset.y;
    }

    public setPosition(spot: Coordinate){
        this.rect.moveTo(spot);
        this.rect.translate(this.offset);
    }
}


