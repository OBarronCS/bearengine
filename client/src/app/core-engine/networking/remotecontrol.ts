
import { Part } from "shared/core/abstractpart";
import { ceil, floor } from "shared/misc/mathutils";
import { randomInt } from "shared/misc/random";
import { mix, Vec2 } from "shared/shapes/vec2";
import { DrawableEntity, Entity } from "../entity";
import { SpritePart } from "../parts";
import { InterpolatedVar, interpolatedvariable, networkedclass_client, remotevariable } from "./cliententitydecorators";


export abstract class RemoteEntity extends Entity {

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



@networkedclass_client("bullet")
export class ClientBullet extends RemoteEntity {

    public sprite = this.addPart(new SpritePart("test2.png"));

    @interpolatedvariable("_pos")
    _pos = InterpolatedVar(new Vec2(0,0));

    // @interpolatedvariable("_x")
    // _x = InterpolatedVar(0);

    // @interpolatedvariable("_y")
    // _y = InterpolatedVar(0);

    update(dt: number): void {
        this.position.set(this._pos.value);
        // this.position.x = this._x.value;
        // this.position.y = this._y.value;

        // this.redraw();
    }
}

// @networkedclass_client("auto")
// export class RemoteAuto extends Entity {

//     public sprite = this.addPart(new SpritePart("tree.gif"));

//     @remotevariable("int32")
//     public health = 1;

//     @remotevariable("double")
//     public xpos = 1;

//     update(dt: number): void {
//         console.log(this.health);
//         this.x = this.xpos
//     }

// }


// @networkedclass_client("sharedEntityForVideo")
// export class ClientHealthEntity extends DrawableEntity {

//     public sprite = this.addPart(new SpritePart("tree.gif"));


//     @remotevariable("float")
//     public health = 100;

//     draw(g: PIXI.Graphics): void {
//         g.beginFill(0x000000)
//         g.drawRect(this.x-100, this.y-100, 60, 60);
//         g.beginFill(0x00FF00);
//         g.drawRect(this.x-100, this.y-100, (this.health / 100) * 60, 60);
//         g.endFill();
//     }
//     update(dt: number): void {

//         this.position.x += randomInt(-10,10);
//         this.position.x += randomInt(-10,10);

//         this.redraw();
//     }
// }











