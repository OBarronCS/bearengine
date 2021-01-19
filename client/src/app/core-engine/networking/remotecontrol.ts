
import { Graphics } from "pixi.js";
import { Part } from "shared/core/abstractpart";
import { BufferStreamReader } from "shared/datastructures/networkstream";
import { Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";
import { SpritePart } from "../parts";

// TODO: Make the part system de-coupled from the update system... maybe
export abstract class RemoteEntity extends Entity {
} 

export class SimpleNetworkedSprite extends RemoteEntity {
    
    private image: SpritePart;

    constructor(){
        super();
        
        this.image = new SpritePart("images/tree.gif");
        this.addPart(this.image);
    }

    draw(g: Graphics): void {}
    update(dt: number): void {}
}


export class RemoteLocations extends Part {

    public locations = new Map<number,Vec2>();

    onAdd(): void {}
    onRemove(): void {}
    update(dt: number): void {}
}

