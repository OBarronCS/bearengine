import { AbstractEntity} from "shared/core/abstractentity"
import { BaseBulletGun } from "./weapons/weapon";
import { ServerBearEngine } from "./serverengine";
import { Vec2 } from "shared/shapes/vec2";

export abstract class ServerEntity extends AbstractEntity<ServerBearEngine> {

    // This shouldn't be touched on entities that are not networked
    // Maybe in future make two seperate lists of entities, one for networked and one for not
    stateHasBeenChanged = false;

    markDirty(): void {
        this.stateHasBeenChanged = true;
    }
}

export class PlayerEntity extends ServerEntity {
    dead = false
    health: number = 100;
    state: number = 0;
    flipped = false;

    mouse: Vec2 = new Vec2(0,0);
    mousedown = false;
    
    item: BaseBulletGun = null;

    update(dt: number): void {
        if(this.item !== null){
            this.item.dir.set(Vec2.subtract(this.mouse, this.item.position));
            this.item.position.set(this.position);
            this.item.operate(this.mousedown);
        }
    }
}


// @networkedclass_server("auto")
// export class FirstAutoEntity extends ServerEntity {
    
//     private tick = new TickTimer(10,true);

//     @networkedvariable("int32")
//     public health = 1;

//     @networkedvariable("double", true)
//     public xpos = 1;

//     update(dt: number): void {
//         if(this.tick.tick()) {
//             this.xpos += random(40)
//         }
//     }
// }



// @networkedclass_server("sharedEntityForVideo")
// export class AutomaticallyUpdatingEntity extends ServerEntity {
    

//     @networkedvariable("float", true)
//     public health = 100;

    
//     update(dt: number): void {
        
//         if(random() < .1){
//             this.health -= 5;
//         }
//     }
// }











// // Another possible ways to do entities: completely manually
// export abstract class TestTestTestNetworkedEntity extends ServerEntity {
//     abstract serialize(stream: BufferStreamWriter): void;
//     abstract deserialize(stream: BufferStreamReader): void;
// }




