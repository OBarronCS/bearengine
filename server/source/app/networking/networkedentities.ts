import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { ServerEntity } from "../entity";
import { networkedclass_server, sync } from "./serverentitydecorators";


@networkedclass_server("ogre")
export class ServerOgre extends ServerEntity {
    @sync("ogre").var("_x")
    _x = 1;

    @sync("ogre").var("asdasd")
    asdasd = 1;
    
    update(dt: number): void {

    }
}

const item_gravity = new Vec2(0,3);

@networkedclass_server("item_entity")
export class ItemEntity extends ServerEntity {

    @sync("item_entity").var("item_id")
    item_id = 0;

    @sync("item_entity").var("pos")
    pos = new Vec2(0,0)


    private active = true;

    constructor(){
        super();
        this.markDirty();
    }

    update(dt: number): void {
        if(this.active){
            if(this.game.terrain.lineCollision(this.pos, Vec2.add(this.pos, item_gravity)) !== null){
                this.active = false;
                // console.log("hit")
            } else {
                this.pos.add(item_gravity);
                this.markDirty()
            }
        }
        
    }

}

