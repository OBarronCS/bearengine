import { AbstractEntity } from "./abstractentity";
import { Rect, Dimension } from "shared/shapes/rectangle";
import { Coordinate } from "shared/shapes/vec2";

export abstract class Part {
    public owner: AbstractEntity;
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


