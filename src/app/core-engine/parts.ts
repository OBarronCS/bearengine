import { Container, DEG_TO_RAD, Sprite, TilingSprite } from "pixi.js";
import { abs, angleDifference, min, sign } from "../math-library/miscmath";
import { Dimension, Rect } from "../math-library/shapes/rectangle";
import { angleBetween, Coordinate } from "../math-library/shapes/vec2";
import { Entity } from "./entity";
import { E } from "./globals";

export abstract class Part {
    public owner: Entity 

    abstract onAdd(): void;
    abstract onRemove(): void;
    abstract update(dt: number): void;
}

// If these get too annoying to write, just change the system
// so there is a pre update and post update (optional?) method on entities
// the main reason I'm not doing that now is because
export class ScriptPart extends Part {
    private script: (dt: number) => void;

    constructor(onUpdate: (dt: number) => void){
        super();
        this.script = onUpdate;
    }

    onAdd(): void { }
    onRemove(): void { }
    update(dt: number): void {
        this.script(dt);
    }
}

export class SpritePart extends Part {

    sprite: Sprite;

    constructor(spr_source: string){
        super();
        this.sprite = new Sprite(E.Engine.renderer.getTexture(spr_source));
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


    /** Moves this image angle to look towards a point, relative to the position of the entitiy */
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

    onAdd(): void {
        E.Engine.renderer.addSprite(this.sprite);
    }

    onRemove(): void {
        E.Engine.renderer.removeSprite(this.sprite);

        this.sprite.destroy({
            children: true,
            baseTexture: false,
            texture: false
        });
    }

    update(dt: number): void {
        this.sprite.position.copyFrom(this.owner.position);
    }
}


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

    onAdd(): void {
        E.Collision.add(this);
    }

    onRemove(): void {
        E.Collision.remove(this);
    }

    update(dt: number): void {
        this.rect.moveTo(this.owner.position);
        this.rect.translate(this.offset);
    }
}

