
import { Part } from "shared/core/abstractpart";
import { ceil, floor } from "shared/mathutils";
import { mix, Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";
import { SpritePart } from "../parts";


export abstract class RemoteEntity extends Entity {} 

export class SimpleNetworkedSprite extends RemoteEntity {
    
    public locations = this.addPart(new RemoteLocations());
    public image = this.addPart(new SpritePart("images/flower.png"));

    constructor(){
        super();
        this.image.originPercent = Vec2.HALFHALF;
    }

    update(dt: number): void {}
}


export class RemoteLocations extends Part {

    public positions = new Map<number,Vec2>();

    addPosition(frame: number, x: number, y: number){
        this.positions.set(frame, new Vec2(x,y));
    }

    setPosition(frame: number){
        const first = this.positions.get(floor(frame));
        const second = this.positions.get(ceil(frame));

        if(first === undefined || second === undefined) return;

        mix(first, second, frame % 1,this.owner.position)
    }
}

