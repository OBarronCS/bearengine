import { Rect, Dimension } from "shared/shapes/rectangle";
import { Coordinate } from "shared/shapes/vec2";
import { Part } from "./abstractpart";



export class ColliderPart extends Part {

    public rect: Rect;
    // Where on the rect is the position
    public offset: Coordinate;

    constructor(dimensions: Dimension,offset: Coordinate){
        super();
        this.rect = new Rect(0,0,dimensions.width, dimensions.height);
        this.offset = {x: 0, y:0};
        this.offset.x = -offset.x;
        this.offset.y = -offset.y;
    }

    onAdd(): void {}

    onRemove(): void {}

    public setPosition(spot: Coordinate){
        this.rect.moveTo(spot);
        this.rect.translate(this.offset);
    }

    update(dt: number): void {
        this.rect.moveTo(this.owner.position);
        this.rect.translate(this.offset);
    }
}

