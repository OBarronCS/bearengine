import { Vec2 } from "shared/shapes/vec2";
import { Test } from "./items"
import type { SharedNetworkedEntities } from "./networkschemas"
import { DefineSchema } from "./serialization"
import { GenerateLinker } from "shared/core/sharedlogic/serialization";


export enum ItemActionType {
    HIT_SCAN,
    TERRAIN_CARVER,
    FORCE_FIELD_ACTION,
}

// Should This be more generic?
// Just a BulletEffect?

export type OnProjectileHitTerrain = {
    type:"boom",
    radius: number
} | {
    type:"particle"
    path:string
}






// Hack to make typescript autocomplete work for item types
function CreateShot<T extends keyof SharedNetworkedEntities, K extends Test<T>>(i: Test<T>){
    return i;
}

export const PROJECTILE_SHOT_DATA = DefineSchema< {[k: string] : Test<keyof SharedNetworkedEntities>} >()({

    SIMPLE_TERRAIN_HIT: CreateShot({
        type:"projectile_bullet",
        item_name:"First example bullet",
        item_sprite:"tree.gif",
        pos: new Vec2(0,0),
        velocity: new Vec2(0,0),
        on_terrain:[
            {
                type:"boom",
                radius:60
            }
        ]
    })
})

export const SHOT_LINKER = GenerateLinker(PROJECTILE_SHOT_DATA);




export class Clip {
    constructor(
        public ammo: number,
        public capacity: number,
        public reload_time: number,
    ){}
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

type ChargeDefinition = {
    type: "charge",
}

export type SimpleWeaponControllerDefinition = AutoDefinition | SemiAutoDefinition | PulseDefinition | ChargeDefinition;

export function CreateShootController(def: SimpleWeaponControllerDefinition): GunshootController {
    
    let trigger: GunshootController
    
    if(def.type === "semiauto"){
        trigger = new SemiAutoController(def.time_between_shots);
    } else if(def.type === "auto"){
        trigger = new AutoController(def.time_between_shots);
    } else if(def.type === "pulse"){
        trigger = new PulseController(def.submode, def.time_between_shots, def.shots_per_burst,def.time_between_bullet);
    } else if(def.type === "charge"){
        trigger = new ChargeController();
    }

    return trigger;
}



export interface GunshootController {
    // returns if we can shoot!
    holdTrigger: (hold: boolean) => boolean;
}

class ChargeController implements GunshootController {

    public percent_per_tick = .02;
    public percent_loss = .01;
    public percent = 0;

    public needToLift = false;
    public lifted = true;

    holdTrigger(hold: boolean): boolean {
        if(hold){
            console.log(this.percent)
            if(this.lifted){
                this.percent += this.percent_per_tick;

                if(this.percent >= 1){
                    this.percent = 0;

                    if(this.needToLift) this.lifted = false;
                    
                    return true;
                }
            }
        } else {
            this.percent -= this.percent_loss;

            this.lifted = true;
        }

        if(this.percent < 0) this.percent = 0;


        return false;
    }
}

// TODO: make this also have a max time, like .2 seconds or something
const percentToQueueShot = .4;

export class SemiAutoController implements GunshootController {


    constructor(time_between_shots: number){
        this.time_between_shots = time_between_shots;
        this.time_since_last_shot = time_between_shots + 1;
    }

    public time_between_shots: number;
    public time_since_last_shot: number;
    
    public last_down = false;
    public queueShot = false;
    
    holdTrigger(_holding: boolean){
        
        this.time_since_last_shot += 1;
        
        if(_holding){
            // if starting click
            if(!this.last_down){
                this.last_down = true;
                // Only queue shot if we are within a certain percent of being able to shoot
                if(this.time_since_last_shot > this.time_between_shots * percentToQueueShot){
                    this.queueShot = true;
                }
            }
        } else {
            // essentially if im releasing
            if(this.last_down){
                this.last_down = false;
            }
        }
        
        // if SHOOT
        if(this.queueShot && (this.time_since_last_shot >= this.time_between_shots)){
            this.queueShot = false
            this.time_since_last_shot = 0;
            
            return true;	
        }
        
        return false;
    }

}

type PulseType = "auto" | "semiauto"

export class PulseController implements GunshootController {

    
    public pulse_shooting = false;
    public time_pulse_shooting = 0;
    
    // auto or semi mode
    public mode: PulseType;
    public helper_controller: GunshootController;;

    constructor(
        mode: PulseType,
        public time_between_shots: number,
        public shots_per_burst: number,
        public time_between_bullet: number,
        ) {
        this.setMode(mode);
    }

    setMode(_mode: PulseType){
        this.mode = _mode;
        if(this.mode == "auto"){
            this.helper_controller = new AutoController(this.time_between_shots);
        } else {
            this.helper_controller = new SemiAutoController(this.time_between_shots);
        }
    }
    

    holdTrigger(_holding: boolean): boolean {
        // if my helper would shoot one, ima start shooting a burst!
        if(this.helper_controller.holdTrigger(_holding)){
            this.pulse_shooting = true;
            this.time_pulse_shooting = 0;
        }
        
        let toShoot = false;
        if(this.pulse_shooting){
            if(this.time_pulse_shooting % this.time_between_bullet == 0){
                toShoot = true;
            }
            
            this.time_pulse_shooting += 1;
            if(this.time_pulse_shooting >= this.time_between_bullet * this.shots_per_burst){
                this.pulse_shooting = false;
            }
        }
        
        return toShoot;
    }
}

export class AutoController implements GunshootController {
    constructor(
        public time_between_shots: number
    ){}

    
    public time_since_last_shot = -1;
    
    holdTrigger(_holding: boolean): boolean{
        this.time_since_last_shot += 1;
        
        if((_holding) && (this.time_since_last_shot > this.time_between_shots)){
            this.time_since_last_shot = 0;
            return true;
        }
            
        return false;
        
    }
}



