import { Attribute } from "shared/core/entityattribute";
import { ITEM_LINKER } from "shared/core/sharedlogic/items";
import { NetArg } from "shared/core/sharedlogic/networkschemas";
import { Sprite } from "shared/graphics/graphics";
import { ceil, floor } from "shared/misc/mathutils";
import { randomInt } from "shared/misc/random";
import { mix, Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";
import { GraphicsPart, SpritePart } from "../parts";
import { net, networkedclass_client } from "./cliententitydecorators";


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
export class ItemEntity_C extends Entity {

    g = this.addPart(new GraphicsPart());
    spritepart = this.addPart(new SpritePart(new Sprite()));

    @net("item_entity").interpolatedvariable("pos")
    pos = new Vec2()

    @net("item_entity").variable("art_path", function(this: ItemEntity_C, i) {
        this.spritepart.sprite.texture = this.engine.renderer.getTexture(i);
    })
    art_path = "";

    constructor(){
        super();
        this.g.graphics.beginFill(0xFF0000);
        this.g.graphics.drawCircle(0, 0, 4);
    }


    update(dt: number): void {
        this.position.set(this.pos);
        this.g.graphics.position.set(this.pos.x, this.pos.y);
    }

}


@networkedclass_client("test_super")
class Test_Super extends Entity {

    @net("test_super").variable("supervar", (e) => {
        console.log(e)
    })
    supervar = 1;

    constructor(){
        super();
        console.log("Test super constructor called!")
    }

    update(dt: number): void {
    }

}


@networkedclass_client("test_sub")
class Test_Sub extends Test_Super {

    @net("test_sub").variable("subvar", (e) => {
        console.log(e)
    })
    subvar = "Hello";

    constructor(){
        super();
        console.log("Test sub constructor called!")
    }
    

    override update(dt: number): void {

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











