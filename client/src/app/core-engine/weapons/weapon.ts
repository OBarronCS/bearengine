import { angleBetween, Vec2 } from "shared/shapes/vec2";
import { GunAddon } from "./addon";
import { CreateGunInfoStruct, ShotInfo } from "./weaponinterfaces";
import { SpriteEntity } from "../entity";
import { Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";
import { SpritePart } from "../parts";


export class BaseBulletGun extends SpriteEntity {
    draw(g: Graphics): void {}
    update(dt: number): void {}

    addons: GunAddon[] = [];
    dir = new Vec2(1,0);

    constructor(addons: GunAddon[] = []){
        super(Vec2.ZERO,"weapon1.png");
        this.addons.push(...addons);

        this.image.originPercent = {x:.5, y:.5}
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


    operate(holding: boolean): void {
        if(this.gunInfo.trigger.holdTrigger(holding)){
            const bulletAmount = this.gunInfo.clip.getBullets();
            if(bulletAmount > 0){

                const baseShotInfo = {...this.gunInfo.shotInfo};
                
                const shotEffect = new BaseBullet(this.position, this.dir.clone().extend(this.gunInfo.shotInfo.speed), baseShotInfo);
                
                this.gunInfo.clip.modifyShot(baseShotInfo,shotEffect);
                for(const addon of this.addons){
                    addon.modifyShot(baseShotInfo, shotEffect);
                }
            
                this.Scene.addEntity(shotEffect);
            }
        }
    }
}


// maybe: add onHitObject callback, onHitTerrain callback? make it easier to implement them?
export class BaseBullet extends Effect {
    
    private sprite: SpritePart;
    
    public shotInfo: ShotInfo;
    public initialPosition: Vec2;
    public velocity: Vec2;


    constructor(initialPosition: Vec2, velocityVec: Vec2, shotInfo: ShotInfo){
        super();

        this.initialPosition = initialPosition.clone();
        this.position.set(initialPosition);

        this.velocity = velocityVec.clone();
        this.shotInfo = shotInfo;
    
        this.sprite = this.addPart(new SpritePart(shotInfo.sprite));
        this.sprite.originPercent = new Vec2(.5,.5);


        this.onUpdate(() => {
            this.position.add(this.velocity);
            this.sprite.angle = angleBetween(this.position, Vec2.add(this.position, this.velocity))

            if(!this.Level.bbox.contains(this.position)){
                this.destroySelf();
            }
        })
    }
}

