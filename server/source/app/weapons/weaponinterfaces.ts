

import { Effect } from "shared/core/effects";
import { ServerBearEngine, ServerEntity } from "../serverengine";
import { SemiAutoController, AutoController, PulseController, GunshootController } from "./triggers";


export enum ItemEnum {
    EMPTY,
    HIT_SCAN,
    TERRAIN_CARVER,
}


export class BulletEffect<BulletType extends ServerEntity> extends Effect<ServerBearEngine> {
    bullet: BulletType;

    constructor(){
        super();
    
        this.onUpdate(function(dt: number){
            if(!this.engine.levelbbox.contains(this.bullet.position)){
                
                this.destroy();
                this.engine.remoteRemoteEntity(this.bullet);

            }
        });
    }
} 

export interface GunAddon {
    modifyShot: (effect: BulletEffect<ServerEntity>) => void,
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
    
    modifyShot(effect: BulletEffect<ServerEntity>){
    
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

// This is an actual object that holds info for a weapon, above is the definition to create 
export interface GunInfo {
    name : string;
    crosshair : string;
    sprite : string;
 
    trigger : GunshootController;
    clip : Clip;

    // All stuff related to a single SHOT is in here!
    shotInfo : ShotInfo;
}


export interface ShotInfo {	
    sprite: string;
    speed: number;
    
    accuracy : number // 1 is fully accurate, 0 is not. There is a range
    accuracyRange : number // max angle in a given direction that 0 percent accuracy could hit by max!
    
    amountOfBullets : number;
    spread : number; // takes effect if more than one bullet
    
    screenshake : number;
    knockback_force : number;
    
    shot_sound : "";
    dryfire_sound : "";
}

// Interface to create the actual object
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

// Creates a functional gun info object from a given info struct
export function CreateGunInfoStruct(createInfo: GunCreationDefinition): GunInfo {
    
    const triggerInfo = createInfo.defaultTrigger;
    let trigger: GunshootController;

    if(triggerInfo.type === "semiauto"){
        trigger = new SemiAutoController(triggerInfo.time_between_shots);
    } else if(triggerInfo.type == "auto"){
        trigger = new AutoController(triggerInfo.time_between_shots);
    } else if(triggerInfo.type == "pulse"){
        trigger = new PulseController(triggerInfo.submode, triggerInfo.time_between_shots, triggerInfo.shots_per_burst,triggerInfo.time_between_bullet);
    }

    const clipInfo = createInfo.defaultClip
    const clip = new Clip(clipInfo.ammo, clipInfo.capacity, clipInfo.reload_time, clipInfo.reload_sound);
    
    return {
        name: createInfo.name,
        crosshair: createInfo.crosshair,
        sprite: createInfo.sprite,
        shotInfo: createInfo.shotInfo,
        clip: clip,
        trigger:trigger,
    }
}


