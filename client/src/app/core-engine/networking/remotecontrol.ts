
import { Graphics } from "pixi.js";
import { BufferStreamReader } from "shared/datastructures/networkstream";
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

