import { Attribute } from "shared/core/entityattribute";
import { ITEM_LINKER } from "shared/core/sharedlogic/items";
import { NetArg } from "shared/core/sharedlogic/networkschemas";
import { Sprite } from "shared/graphics/graphics";
import { ceil, floor } from "shared/misc/mathutils";
import { randomInt } from "shared/misc/random";
import { mix, Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";
import { GraphicsPart, SpritePart } from "../parts";
import { InterpolatedVar, net, networkedclass_client } from "./cliententitydecorators";


export class RemoteLocations extends Attribute {

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
export class ClientBullet extends Entity {

    public sprite = this.addPart(new SpritePart("test2.png"));


    @net("bullet").interpolatedvariable("test")
    test = InterpolatedVar(1);

    @net("bullet").interpolatedvariable("_pos")
    _pos = InterpolatedVar(new Vec2(0,0));



    @net("bullet").event("testEvent7")
    callback(data: NetArg<"bullet","testEvent7",0>, testNumber: number){
        console.log(JSON.stringify(data), testNumber);
    }

    update(dt: number): void {
        this.position.set(this._pos.value);
        // this.position.x = this._x.value;
        // this.position.y = this._y.value;

        // this.redraw();
    }
}

@networkedclass_client("ogre")
export class Ogre extends Entity {

    public sprite = this.addPart(new SpritePart("flower.png"));


    @net("ogre").variable("_x")
    _x = 1;

    @net("ogre").variable("asdasd")
    asdasd = 123;

    update(dt: number): void {
        this.position.x = this._x;

    }
}


@networkedclass_client("item_entity")
export class CItemEntity extends Entity {

    g = this.addPart(new GraphicsPart());
    spritepart = this.addPart(new SpritePart(new Sprite()));

    @net("item_entity").interpolatedvariable("pos")
    pos = InterpolatedVar(new Vec2(0,0))

    @net("item_entity").variable("item_id", function(this: CItemEntity, i) {
        this.spritepart.sprite.texture = this.engine.renderer.getTexture(ITEM_LINKER.ItemData(i).item_sprite);
    })
    item_id: number = 0;

    constructor(){
        super();
        this.g.graphics.beginFill(0xFF0000);
        this.g.graphics.drawCircle(0, 0, 4);
    }


    update(dt: number): void {
        this.position.set(this.pos.value);
        this.g.graphics.position.set(this.pos.value.x, this.pos.value.y);
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











