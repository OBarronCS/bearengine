import type { Graphics } from "pixi.js";
import { angleBetween, Vec2 } from "shared/shapes/vec2";
import { AddOnType, BulletEffect, CreateGunInfoStruct, GunAddon } from "server/source/app/weapons/weaponinterfaces";

import { ServerEntity } from "../serverengine"
import { networkedclass_server, networkedvariable } from "../networking/serverentitydecorators";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";

export class TerrainHitAddon implements GunAddon {
    addontype: AddOnType = AddOnType.SPECIAL;

    modifyShot(effect: BulletEffect<ServerBullet>){
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
                this.engine.remoteRemoteEntity(this.bullet);
            }
        })
        
    }
}

export class BaseBulletGun extends ServerEntity {
    draw(g: Graphics): void {}
    update(dt: number): void {}

    addons: GunAddon[] = [];
    dir = new Vec2(1,0);

    constructor(addons: GunAddon[] = []){
        super();
        this.addons.push(...addons);
    }

    public gunInfo = CreateGunInfoStruct({
        name : "Default",
        crosshair : "",
        sprite : "",

        defaultTrigger: {
            type: "auto",
            time_between_shots : 2,
        },
        defaultClip: {
            ammo : 20, 
            capacity : 20,
            reload_time : 20,
            reload_sound : 20
        },
        shotInfo : {
            sprite:"test2.png",
            accuracy:1,
            accuracyRange:1,
            amountOfBullets:1,
            dryfire_sound:"",
            knockback_force:123,
            screenshake:1,
            shot_sound:"",
            speed:20,
            spread:1,
        }
    });

    operate(holding: boolean): boolean {
        if(this.gunInfo.trigger.holdTrigger(holding)){
            const bulletAmount = this.gunInfo.clip.getBullets();
            if(bulletAmount > 0){

                const baseShotInfo = {...this.gunInfo.shotInfo};
                
                const bullet = new ServerBullet();
            
                bullet.position.set(this.position);
                bullet.velocity = this.dir.clone().extend(this.gunInfo.shotInfo.speed);

                const bEffect = new BulletEffect();
                bEffect.bullet = bullet

                this.gunInfo.clip.modifyShot(bEffect);
                for(const addon of this.addons){
                    addon.modifyShot(bEffect);
                }
            
                this.scene.addEntity(bEffect);
                this.engine.createRemoteEntity(bullet);
            }
            return true;
        }

        return false;
    }
}


@networkedclass_server("bullet")
export class ServerBullet extends ServerEntity {

    public velocity: Vec2;
    
    @networkedvariable("_pos")
    _pos = new Vec2(0,0);

    @networkedvariable("test", true)
    test = 1;

    // @networkedvariable("_x",true)
    // _x = 0;

    // @networkedvariable("_y",true)
    // _y = 0;

    update(dt: number): void {
        this.position.add(this.velocity);
        
        this._pos.set(this.position);
        this.markDirty();

        this.test += 1;
        
        // this._x = this.x;
        // this._y = this.y;     
    }
}


