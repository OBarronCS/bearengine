
// General interfaces

import { SemiAutoController, AutoController, PulseController, GunshootController } from "./triggers";
import { Clip } from "./addon";

// Definitions for creating the objects
type AutoDefinition = {
    type: "auto"
    time_between_shots:number
}

type SemiAutoDefinition = {
    type: "semiauto"
    time_between_shots:number
}

type PulseDefinition = {
    type: "pulse"
    time_between_shots: number,
    shots_per_burst: number,
    time_between_bullet: number,
    submode: "auto"|"semiauto"
}

export interface GunCreationDefinition {
    name : string,
    crosshair : string, // file paths
    sprite : string,

    defaultTrigger: AutoDefinition | SemiAutoDefinition | PulseDefinition,

    defaultClip: {
        capacity : number,
        ammo : number, // current amount of ammo
        reload_time : number,
        reload_sound : number
    },
    shotInfo: ShotInfo
}

// This is an actual object that holds info for a weapon, above is the definition to create 
export interface GunInfo {
	name : string;
	crosshair : string; // a sprite or something to reference a sprite
	sprite : string;
 
	defaultTrigger : GunshootController;
	defaultClip : Clip;

	// All stuff related to a single SHOT is in here!
	shotInfo : ShotInfo;
}


const emptyGunInfo: GunInfo = {
    name : "name",
	crosshair : "",
    sprite : "",
    
	defaultTrigger : null,
	defaultClip : null,

	shotInfo : null,
}

// Creates a functional gun info object from a given info struct
export function CreateGunInfoStruct(json_struct: GunCreationDefinition){
	const gunInfo: GunInfo = {...emptyGunInfo};
	
	gunInfo.name = json_struct.name;
	gunInfo.crosshair = json_struct.crosshair;
	gunInfo.sprite = json_struct.sprite;

	const trigger = json_struct.defaultTrigger;
	if(trigger.type === "semiauto"){
        gunInfo.defaultTrigger = new SemiAutoController(trigger.time_between_shots);
	} else if(trigger.type == "auto"){
        gunInfo.defaultTrigger = new AutoController(trigger.time_between_shots);
	} else if(trigger.type == "pulse"){
        gunInfo.defaultTrigger = new PulseController(trigger.submode, trigger.time_between_shots, trigger.shots_per_burst,trigger.time_between_bullet);
	}
    const ci = json_struct.defaultClip
	let clip = new Clip(ci.ammo, ci.capacity, ci.reload_time, ci.reload_sound);
    
    gunInfo.defaultClip = clip;

    gunInfo.shotInfo = json_struct.shotInfo;

	return gunInfo;
}


// All guns have default values of these
// Things that are directly effecting the bullet being shot! --> 
// info is handed to an effect which hands info to bullet objects at creation
export interface ShotInfo {
	bulletEffectType : "" // creates default bullet --> almost all will use this!
	
	sprite : string
	speed : number
	
	accuracy : number // 1 is fully accurate, 0 is not. There is a range
	accuracyRange : number // max angle in a given direction that 0 percent accuracy could hit by max!
	

	amountOfBullets : number;
	spread : number; // takes effect if more than one bullet
	
	screenshake : number;
	knockback_force : number;
	
	shot_sound : "";
	dryfire_sound : "";
}

