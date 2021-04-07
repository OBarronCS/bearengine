import { AbstractEntity, EntityID } from "./abstractentity";
import { Rect, Dimension } from "shared/shapes/rectangle";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { getEntityIndex } from "./scene";

export abstract class Part {
    public static partID = -1; 
    public owner: AbstractEntity;
}


export class PartContainer<T extends Part> {

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
    public offset: Vec2;

    constructor(dimensions: Dimension,offset: Coordinate){
        super();
        this.rect = new Rect(0,0,dimensions.width, dimensions.height);
        this.offset = new Vec2(-offset.x,-offset.y);
    }

    public setPosition(spot: Coordinate){
        this.rect.moveTo(spot);
        this.rect.translate(this.offset);
    }
}


