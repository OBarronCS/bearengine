import { Gun, Hitscan, ModularGun, TerrainHitAddon } from "./weapons/remoteweapon";
import { Vec2 } from "shared/shapes/vec2";
import { Clip, CreateShootController, ItemEnum } from "../../../shared/core/sharedlogic/weapondefinitions";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";
import { ServerEntity } from "./entity";
import "./networking/networkedentities";


export class PlayerEntity extends ServerEntity {
    dead = false
    health: number = 100;
    state: number = 0;
    flipped = false;

    mouse: Vec2 = new Vec2(0,0);
    mousedown = false;
    
    item: Gun = null;

    update(dt: number): void {
        if(this.item !== null){
            this.item.direction.set(Vec2.subtract(this.mouse, this.item.position));
            this.item.position.set(this.position);
            if(this.mousedown){
                this.item.holdTrigger();
            }
        }
    }

    setItem(item: ItemEnum){
        if(this.item !== null) this.scene.destroyEntity(this.item);

        switch(item){
            case ItemEnum.EMPTY: {
                this.item = null;
                break;
            }
            case ItemEnum.HIT_SCAN: {
                this.item = new Hitscan();
                this.scene.addEntity(this.item);
                break;
            }

            case ItemEnum.TERRAIN_CARVER: {
                const gun = new ModularGun(
                    CreateShootController({type:"auto", time_between_shots: 10}),
                    new Clip(100,100,100),
                    [
                    new TerrainHitAddon(),
                    {
                        modifyShot(bullet){
                            bullet.onInterval(2, function(times){
                                this.velocity.drotate(random_range(-6,6))
                            })
                        }
                    },
                    {
                        gravity: new Vec2(0,.35),
                        modifyShot(effect){
                
                            const self = this;
                
                            effect.onUpdate(function(){
                                this.velocity.add(self.gravity);
                            })
                        }
                    },
                    ]
                );
                this.item = gun;
                this.scene.addEntity(gun);
                break;
            }

            default: AssertUnreachable(item);
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




