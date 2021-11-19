import { Attribute } from "shared/core/entityattribute";
import { ColliderPart } from "shared/core/entitycollision";
import { Graphics } from "shared/graphics/graphics";
import { dimensions, Rect } from "shared/shapes/rectangle";
import { Vec2 } from "shared/shapes/vec2";
import { DrawableEntity } from "../core-engine/entity";

export class BoostDirection extends Attribute {
    constructor(public dir: Vec2){super()}
}

export class BoostZone extends DrawableEntity {

    constructor(rect: Rect){
        super();

        this.collider = (this.addPart(new ColliderPart(dimensions(rect.width, rect.height),new Vec2(),"BoostZone")));
        this.position.set(rect);
        this.redraw();
    }

    private collider: ColliderPart
    private dir = this.addPart(new BoostDirection(Vec2.random().scale(1)));

    update(dt: number): void {
        this.redraw()
    }
     
    draw(g: Graphics): void {
        g.lineStyle(2,0xFFFFFF, 1);
        this.collider.rect.draw(g);
    }
}


