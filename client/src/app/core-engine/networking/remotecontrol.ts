
import { Graphics } from "pixi.js";
import { Part } from "shared/core/abstractpart";
import { BufferStreamReader } from "shared/datastructures/networkstream";
import { ceil, floor } from "shared/miscmath";
import { mix, Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";
import { SpritePart } from "../parts";

// TODO: Make the part system de-coupled from the update system... maybe
export abstract class RemoteEntity extends Entity {
} 

export class SimpleNetworkedSprite extends RemoteEntity {
    
    public locations = new RemoteLocations();
    private image: SpritePart;

    constructor(){
        super();
        
        this.addPart(this.locations)

        this.image = new SpritePart("images/tree.gif");
        this.addPart(this.image);
    }

    draw(g: Graphics): void {}
    update(dt: number): void {}
}


export class RemoteLocations extends Part {

    public positions = new Map<number,Vec2>();

    addPosition(frame: number, x: number, y: number){
        this.positions.set(frame, new Vec2(x,y));
    }

    setPosition(frame: number){
        console.log("POs")
        const first = this.positions.get(floor(frame));
        const second = this.positions.get(ceil(frame));

        if(first === undefined || second === undefined) return;

        mix(first, second, frame % 1,this.owner.position)
    }


    onAdd(): void {}
    onRemove(): void {}
    update(dt: number): void {}
}

