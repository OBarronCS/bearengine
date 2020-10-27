import { Vec2 } from "../math-library/vec2";
import { Container, DisplayObject, Sprite, Graphics, TextureMatrix } from "pixi.js";
import { E } from "./globals";



export abstract class Entity {
    readonly position: Vec2 = new Vec2(0,0)
    readonly parts: Part[] = [];
    readonly graphics: Graphics

    get x() { return this.position.x; }
    get y() { return this.position.y; }

    constructor() {
        this.graphics = new Graphics();
    }
    
    addPart(part: Part){
        this.parts.push(part);
        part.owner = this;
        part.onAdd(); 
    }

    updateParts(dt: number){
        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            part.update(dt);
        }
    }

    redraw(){
        this.draw(this.graphics);
    }

    abstract update(dt: number): void;
    abstract draw(g: Graphics): void
}


abstract class Part {
    public owner: Entity 

    abstract onAdd(): void;
    abstract onRemove(): void;
    abstract update(dt: number): void;
}

export class SpritePart extends Part {
    container: Container = new Container();
    constructor(displayObj: Container){
        super();
        this.container.addChild(displayObj)
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



