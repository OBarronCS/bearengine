
import { Vec2 } from "shared/shapes/vec2";
import { ServerEntity } from "./entity";
import { PlayerEntityTakeDamagePacket } from "./networking/gamepacketwriters";
import { ConnectionID } from "./networking/serversocket";
import { PlayerInformation, ROUND_START_WAIT_SECONDS } from "./serverengine";
import { BeamEffect_S, check_line_movingball_collision, InstantDeathLaser_S, SBaseItem } from "./weapons/serveritems";

export class ServerPlayerEntity extends ServerEntity {

    readonly last_position: Vec2 = new Vec2();

    readonly connectionID: ConnectionID;
    readonly client: PlayerInformation;

    constructor(connectionID: ConnectionID, client: PlayerInformation){
        super();
        this.connectionID = connectionID;
        this.client = client;
    }

    item_in_hand: SBaseItem<any> = null;
    
    setItem(item: SBaseItem<any>){
        this.item_in_hand = item;
    }

    clearItem(){
        this.item_in_hand = null;
    }


    private health: number = 100;
    take_damage(amount: number){
        this.health -= amount;

        this.game.enqueueGlobalPacket(
            new PlayerEntityTakeDamagePacket(this.connectionID,this.health, amount)
        );
    }

    get_health(){ return this.health; }

    force_set_health(new_health: number){
        this.health = new_health;
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

        if(this.game.active_scene.round_timer > ROUND_START_WAIT_SECONDS * this.game.TICK_RATE){
            const lasers = this.game.entities.view(InstantDeathLaser_S);
            for(const laser of lasers){
                if(check_line_movingball_collision(laser.line, 20, this.last_position, this.position)){
                    this.take_damage(100);
                }
            }
        }

        this.last_position.set(this.position);
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




