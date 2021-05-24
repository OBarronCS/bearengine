import type { Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";
import { angleBetween, Vec2 } from "shared/shapes/vec2";
import { CreateGunInfoStruct } from "server/source/app/weapons/weaponinterfaces";
import { AddOnType, GunAddon } from "server/source/app/weapons/addon";

import { ServerBearEngine } from "../serverengine";
import { ServerEntity } from "../serverentity";
import { networkedclass_server, networkedvariable } from "../networking/serverentitydecorators";


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

export class BulletEffect extends Effect<ServerBearEngine> {
    bullet: ServerBullet;

    constructor(){
        super();
    
        this.onUpdate(function(dt: number){
            if(!this.engine.levelbbox.contains(this.bullet.position)){
                this.destroy();
            }
        });
    }

    destroy(){
        this.destroySelf();
        this.engine.remoteRemoteEntity(this.bullet);
    }
} 


@networkedclass_server("bullet")
export class ServerBullet extends ServerEntity {

    public velocity: Vec2;
    
    @networkedvariable("float",true)
    _x = 0;

    @networkedvariable("float",true)
    _y = 0;

    update(dt: number): void {
        this.position.add(this.velocity);
        
        this._x = this.x;
        this._y = this.y;     
    }
}


