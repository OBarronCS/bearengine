import { Container, DEG_TO_RAD } from "pixi.js";
import { Coordinate } from "../math-library/vec2";
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

    container: Container = new Container();

    constructor(displayObj: Container){
        super();
        this.container.addChild(displayObj);
    }

    /** Sets point on the sprite that sits on position vector */
    set offset(offset: Coordinate) {
        this.container.pivot.set(-offset.x, -offset.y);
    }

    set visible(v: boolean){
        this.container.visible = v;
    }

    set scale(s: Coordinate) {
        this.container.scale.set(s.x,s.y);
    }

    set width(w: number){
        this.container.width = w;
    }

    set height(h: number){
        this.container.height = h;
    }

    set alpha(a: number){
        this.container.alpha = a;
    }

    /** RADIANS */
    set angle(radians: number ){
        this.container.rotation = radians;
    }

    /** DEGREES */
    set dangle(degrees: number){
        this.angle = degrees * DEG_TO_RAD;
    }

    onAdd(): void {
        E.Engine.renderer.addSprite(this.container);
    }

    onRemove(): void {
        E.Engine.renderer.removeSprite(this.container);
        this.container.destroy({
            children: true,
            baseTexture:false,
            texture: false
        });
    }

    update(dt: number): void {
        this.container.position.copyFrom(this.owner.position)
    }
}



