import { Attribute } from "shared/core/entityattribute";
import { ColliderPart } from "shared/core/entitycollision";
import { Graphics } from "shared/graphics/graphics";
import { dimensions, Rect } from "shared/shapes/rectangle";
import { drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Vec2 } from "shared/shapes/vec2";
import { DrawableEntity } from "../core-engine/entity";

export class BoostDirection extends Attribute {
    constructor(public dir: Vec2){super()}
}

export class BoostZone extends DrawableEntity {

    private collider: ColliderPart
    private dir: BoostDirection;

    private readonly str = 2;

    constructor(rect: Rect, dir: Vec2){
        super();

        this.collider = (this.addPart(new ColliderPart(dimensions(rect.width, rect.height),new Vec2(),"BoostZone")));
        this.dir = this.addPart(new BoostDirection(dir.extend(this.str)));
        
        this.position.set(rect);
        this.redraw();
    }



    update(dt: number): void {
        this.redraw()
    }
     
    draw(g: Graphics): void {
        g.lineStyle(2,0xFFFFFF, 1);
        this.collider.rect.draw(g);
        drawVecAsArrow(g, this.dir.dir, this.x + this.collider.rect.width / 2, this.y + this.collider.rect.height / 2, 50); 
    }
}


