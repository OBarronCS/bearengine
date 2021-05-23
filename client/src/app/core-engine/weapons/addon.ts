import { ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { Vec2 } from "shared/shapes/vec2";
import { RemotePlayer } from "../../gamelogic/player";
import { BaseBullet } from "./weapon";
import { ShotInfo } from "./weaponinterfaces";

export interface GunAddon {
    modifyShot: (struct: ShotInfo, effect: BaseBullet) => void,
    addontype: AddOnType;
    [key: string]: any; // allow for random data
}

export enum AddOnType {
    SCOPE,
    CLIP, // effects reload speed and size --> maybe some hold specific types of bullets that have extra info
    SPECIAL, // Everythihng else --> Like flash light, laser, wind fire ice 
    TEMP
}

export class Clip implements GunAddon {
    public addontype = AddOnType.CLIP

    constructor(
        public ammo: number,
        public capacity: number,
        public reload_time: number,
        public reload_sound: number
    ){}
    
    modifyShot(struct: ShotInfo, effect: BaseBullet){
    
    }

    // Returns amount of bullets we can shoot
    // if return zero, we have no ammo and need to RELOAD
    getBullets(){
        return 1;
    }
    
    reload(){}
}


export class TerrainHitAddon implements GunAddon {
    addontype: AddOnType = AddOnType.SPECIAL;

    modifyShot(struct: ShotInfo, effect: BaseBullet){
        effect.onUpdate(function(){
            const testTerrain = this.engine.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)))

            const RADIUS = 40;
            const DMG_RADIUS = 40;

            if(testTerrain){
                this.engine.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

                const network = this.engine.networksystem;
                network.queuePacket({
                    write(stream){
                        stream.setUint8(ServerBoundPacket.TERRAIN_CARVE_CIRCLE);
                        stream.setFloat64(testTerrain.point.x)
                        stream.setFloat64(testTerrain.point.y)
                        stream.setInt32(RADIUS);
                    }
                })
            
               
                this.destroySelf();
            }
        })
        
    }
}






