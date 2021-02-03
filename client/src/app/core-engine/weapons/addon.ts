
import { DefaultBulletEffect } from "../clienteffects";
import { ShotInfo } from "./weaponinterfaces";

export interface GunAddon {
	modifyShot: (struct: ShotInfo, effect: DefaultBulletEffect) => void,
	addontype: AddOnType;
}

export enum AddOnType {
	SCOPE,
	CLIP, // effects reload speed and size --> maybe some hold specific types of bullets that have extra info
	SPECIAL, // Everythihng else --> Like flash light, laser, wind fire ice 
	TEMP
}

export class Clip implements GunAddon {
	// Some way to define ammo types for pickups ... or no pickups for now?
	constructor(
		public ammo: number,
		public capacity: number,

		public reload_time: number,
		public reload_sound: number
	){};
	
	addontype = AddOnType.CLIP
	modifyShot(struct: ShotInfo, effect: DefaultBulletEffect){
	
	}

	// Returns amount of bullets we can shoot
	// if return zero, we have no ammo and need to RELOAD
	// Auto removes a bullet
	getBullets(){
		return 1;
	}
	
	reload(){}
}


