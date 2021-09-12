
import { Vec2 } from "shared/shapes/vec2";
import { ServerEntity } from "./entity";
import { ConnectionID } from "./networking/serversocket";

import "./networking/networkedentities";

export class ServerPlayerEntity extends ServerEntity {

    constructor(public connectionID: ConnectionID){
        super();
    }
    dead = false
    health: number = 100;
    state: number = 0;
    flipped = false;

    mouse: Vec2 = new Vec2(0,0);
    mousedown = false;
    
    // item: Gun<any> = null;

    update(dt: number): void {
        // if(this.item !== null){
        //     this.item.direction.set(Vec2.subtract(this.mouse, this.item.position));
        //     this.item.position.set(this.position);
        //     // if(this.mousedown){
        //     //     this.item.holdTrigger();
        //     // }
        // }
    }

    // // setWeapon(gun: Gun<any>){
    // //     this.item = gun;
    // // }

    // clearItem(){
    //     this.item = null;
    // }
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




