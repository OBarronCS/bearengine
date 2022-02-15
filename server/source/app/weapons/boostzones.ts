
import { Attribute } from "shared/core/entityattribute";
import { ColliderPart } from "shared/core/entitycollision";
import { Rect, dimensions } from "shared/shapes/rectangle";
import { Vec2 } from "shared/shapes/vec2";
import { ServerEntity } from "../entity";

export class BoostDirection extends Attribute {
    constructor(public dir: Vec2){super()}
}

export class BoostZone_S extends ServerEntity {

    public collider: ColliderPart
    private dir: BoostDirection;

    private readonly str = 2;

    constructor(rect: Rect, dir: Vec2){
        super();

        this.position.set(rect);

        this.collider = (this.addPart(new ColliderPart(dimensions(rect.width, rect.height),new Vec2())));
        this.dir = this.addPart(new BoostDirection(dir.extend(this.str)));
    }
    
    update(dt: number): void {

    }

}

