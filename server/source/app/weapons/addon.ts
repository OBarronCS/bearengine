import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Vec2 } from "shared/shapes/vec2";
import { BulletEffect } from "./weapon";

export interface GunAddon {
    modifyShot: (effect: BulletEffect) => void,
    addontype: AddOnType;
    [key: string]: any; // allow for random data
}


export class Clip implements GunAddon {
    public addontype = AddOnType.CLIP

    constructor(
        public ammo: number,
        public capacity: number,
        public reload_time: number,
        public reload_sound: number
    ){}
    
    modifyShot(effect: BulletEffect){
    
    }

    // Returns amount of bullets we can shoot
    // if return zero, we have no ammo and need to RELOAD
    getBullets(){
        return 1;
    }
    
    reload(){}
}
export enum AddOnType {
    SCOPE,
    CLIP, // effects reload speed and size --> maybe some hold specific types of bullets that have extra info
    SPECIAL, // Everythihng else --> Like flash light, laser, wind fire ice 
    TEMP
}


export class TerrainHitAddon implements GunAddon {
    addontype: AddOnType = AddOnType.SPECIAL;

    modifyShot(effect: BulletEffect){
        effect.onUpdate(function(){
            const testTerrain = this.engine.terrain.lineCollision(this.bullet.position,Vec2.add(this.bullet.position, this.bullet.velocity.clone().extend(100)));
            
            const RADIUS = 40;
            const DMG_RADIUS = 80;

            if(testTerrain){
                this.engine.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

                this.engine.queuePacket({
                    write(stream){
                        stream.setUint8(GamePacket.PASSTHROUGH_TERRAIN_CARVE_CIRCLE);
                        stream.setFloat64(testTerrain.point.x);
                        stream.setFloat64(testTerrain.point.y);
                        stream.setInt32(RADIUS);
                    }
                })

                const point = new Vec2(testTerrain.point.x,testTerrain.point.y);

                // Check in radius to see if any players are hurt
                for(const client of this.engine.clients){
                    const p = this.engine.players.get(client);

                    if(Vec2.distanceSquared(p.playerEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
                        p.playerEntity.health -= 16;
                    }
                } 
            
               
                this.destroy();
            }
        })
        
    }
}






