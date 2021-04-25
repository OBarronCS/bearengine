import { DEG_TO_RAD, Graphics, Sprite } from "pixi.js";
import { abs, angleDifference, min, sign } from "shared/mathutils"
import { angleBetween, Coordinate } from "shared/shapes/vec2";
import { Part } from "shared/core/abstractpart"


export class GraphicsPart extends Part {
    readonly graphics: Graphics = new Graphics();
}

export class SpritePart extends Part {
    public file_path: string;
    public sprite: Sprite;

    constructor(spr_source: string | Sprite){
        super();
        if(typeof spr_source === "string"){
            this.file_path = spr_source;
            this.sprite = new Sprite();
        } else {
            this.file_path = ""
            this.sprite = spr_source;
        }
    }

    /** Sets point on the sprite that sits on position vector */
    set origin(offset: Coordinate) { this.sprite.pivot.set(offset.x, offset.y); }
    get origin(): Coordinate { return this.sprite.pivot; }

    set originPercent(offset: Coordinate) {
        this.sprite.anchor.set(offset.x, offset.y);
    }

    set visible(v: boolean){ this.sprite.visible = v; }
    get visible(){ return this.sprite.visible; }

    set scale(s: Coordinate) {
        this.sprite.scale.set(s.x,s.y);
    }

    set width(w: number){ this.sprite.width = w; }
    get width(){ return this.sprite.width; }

    set height(h: number){ this.sprite.height = h; }
    get height(){ return this.sprite.height; }

    set alpha(a: number){ this.sprite.alpha = a; }
    get alpha(){ return this.sprite.alpha; }

    /** RADIANS */
    set angle(radians: number ){ this.sprite.rotation = radians; }
    get angle(){ return this.sprite.rotation; }

    /** DEGREES */
    set dangle(degrees: number){ this.angle = degrees * DEG_TO_RAD; }
    get dangle(){ return this.sprite.angle; }


    /** Rotates image to look towards a point, relative to the position of the entitiy */
    angleTowardsPoint(point: Coordinate, speed: number){
        this.angleTowards(angleBetween(this.owner.position,point),speed)
    }

    /** RADIANS, does not overshoot */
    angleTowards(angle: number, speed: number){
        const diff = angleDifference(this.angle, angle);
        const angleMagnitude = min(abs(diff), speed);
        this.angle += sign(diff) * angleMagnitude;
    }

    /** DEGREES */
    dangleTowards(angle: number, speed: number){
        this.angleTowards(angle * DEG_TO_RAD, speed);
    }
}




