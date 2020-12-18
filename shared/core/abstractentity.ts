import { Vec2 } from "shared/shapes/vec2";
import { Part } from "./abstractpart";


// Client and Server should subclass this

export abstract class AbstractEntity {
    readonly position: Vec2 = new Vec2(0,0)
    readonly parts: Part[] = [];

    get x() { return this.position.x; }
    get y() { return this.position.y; }

    set x(_x) { this.position.x = _x; }
    set y(_y) { this.position.y = _y; }

    
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

    abstract update(dt: number): void;
    
    // Intended for us by abstract classes for behind the scenes work
    public postUpdate(): void {}
}






