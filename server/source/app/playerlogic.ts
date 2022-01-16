
import { Vec2 } from "shared/shapes/vec2";
import { ServerEntity } from "./entity";
import { ConnectionID } from "./networking/serversocket";
import { BeamEffect_S, SBaseItem } from "./weapons/serveritems";

export class ServerPlayerEntity extends ServerEntity {

    constructor(public connectionID: ConnectionID){
        super();
    }

    item_in_hand: SBaseItem<any> = null;
    
    setItem(item: SBaseItem<any>){
        this.item_in_hand = item;
    }

    clearItem(){
        this.item_in_hand = null;
    }


    public health: number = 100;

    // not in use rn
    healthIsDirty = false;
    loseHealth(amount: number){
        this.health -= amount;
        this.healthIsDirty = true;
    }

    
    dead = false
    
    animation_state: number = 0;
    flipped = false;

    mouse: Vec2 = new Vec2(0,0);
    readonly look_dir: Vec2 = new Vec2(1,0);

    current_beam: BeamEffect_S = null;

    setLookDirection(): void {
        const dir = Vec2.subtract(this.mouse, this.position);
        if(!dir.isZero()){
            this.look_dir.set(dir.normalize());
        } else {
            this.look_dir.set({x: 1, y: 1});
        }

    }

    mousedown = false;

    override onDestroy(): void {
        this.game.endPlayerBeam_Player(this);
    }

    update(dt: number): void {
        // if(this.item !== null){
        //     this.item.direction.set(Vec2.subtract(this.mouse, this.item.position));
        //     this.item.position.set(this.position);
        //     // if(this.mousedown){
        //     //     this.item.holdTrigger();
        //     // }
        // }
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




