import { Vec2 } from "shared/shapes/vec2";
import { E } from "../globals";
import { SemiAutoController, PulseController, GunshootController, AutoController } from "./triggers";
import { Clip, GunAddon } from "./addon";
import { DefaultBulletEffect } from "../effects/effects";
import { GunInfo, CreateGunInfoStruct } from "./weaponinterfaces";


interface Gun {
    setLocation: (position: Vec2, dir:Vec2) => void,
    operate: (holding: boolean) => void,
    gunInfo: GunInfo
}

export class DefaultGun implements Gun {
	gunInfo = CreateGunInfoStruct({
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
			accuracy:1,
			accuracyRange:1,
			amountOfBullets:1,
			bulletEffectType:"",
			dryfire_sound:"",
			knockback_force:123,
			screenshake:1,
			shot_sound:"",
			speed:1,
			spread:1,
			sprite:""
		}
	});
	
	trigger = this.gunInfo.defaultTrigger;
	clip = this.gunInfo.defaultClip;
	
	// Upon the trigger returning true and shooting, a data struct is sent through the clip and all add-ons
	addons: GunAddon[] = [];
	
	position = new Vec2(0,0)
	dir = new Vec2(1,0)


	setLocation(_position:Vec2, _dir:Vec2): void{
		this.position.set(_position);
		this.dir.set(_dir);
	}

	operate(holding: boolean): void{
		if(this.trigger.holdTrigger(holding)){
			const bulletAmount = this.clip.getBullets();
			if(bulletAmount > 0){
				const defaultInfo = {...this.gunInfo.shotInfo};
				
				const shotEffect = new DefaultBulletEffect(this.position, this.dir.clone().extend(20), defaultInfo)
				
				this.clip.modifyShot(defaultInfo,shotEffect);
				
				for (let i = 0; i < this.addons.length; ++i) {
				    const addon = this.addons[i];
					addon.modifyShot(defaultInfo, shotEffect);
				}
			
				E.Engine.effectHandler.addEffect(shotEffect);
			}
		}
	}
}


