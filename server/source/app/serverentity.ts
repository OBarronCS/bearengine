import { AbstractEntity} from "shared/core/abstractentity"
import { BaseBulletGun, ServerBullet, TerrainHitAddon } from "./weapons/weapon";
import { ServerBearEngine, ServerEntity } from "./serverengine";
import { Vec2 } from "shared/shapes/vec2";
import { AddOnType, BulletEffect, ItemEnum } from "./weapons/weaponinterfaces";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";



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

    setItem(item: ItemEnum){
        switch(item){
            case ItemEnum.EMPTY: {
                this.item = null;
                break;
            }
            case ItemEnum.HIT_SCAN: {
                this.item = null;
                break;
            }

            case ItemEnum.TERRAIN_CARVER: {
                const gun = new BaseBulletGun(
                    [
                    new TerrainHitAddon(),
                    {
                        addontype: AddOnType.SPECIAL,
                        modifyShot(effect: BulletEffect<ServerBullet>){
                            effect.onInterval(2, function(times){
                                this.bullet.velocity.drotate(random_range(-6,6))
                            })
                        }
                    },
                    {
                        addontype: AddOnType.SPECIAL,
                        gravity: new Vec2(0,.35),
                        modifyShot(effect: BulletEffect<ServerBullet>){
                
                            const self = this;
                
                            effect.onUpdate(function(){
                                this.bullet.velocity.add(self.gravity);
                            })
                        }
                    },
                    ]
                );
                this.scene.addEntity(gun);
                this.item = gun;
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




