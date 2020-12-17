import { Effect } from "../client/src/app/core-engine/effecthandler"
import { E } from "../client/src/app/core-engine/globals";
import { clamp } from "shared/miscmath";
import { Color, blend } from "./datastructures/color";
import { Vec2, mix, Coordinate } from "./shapes/vec2";


abstract class Tween<T> extends Effect  {
    public object: object
    public property: string

    public initialValue: T;
    public finalValue: T;

    public active = false;

    // the length of the tween
    public seconds: number;
    // How far into the tween we are, [0,1]
    public t = 0;

    // Linear by default
    public easingfunction: (t: number) => number = t => t

    repeat?: number
    loop?: boolean;
    pingpong?: boolean

    //onPingpong():
    //onRepeat()

    // set in chain function
    public nextChain: Tween<any>;

    constructor(obj: object, prop: string, seconds: number){
        super();
        this.object = obj;
        this.property = prop;
        this.seconds = seconds;
        this.onUpdate(function(this: Tween<any>, dt){
            if(this.active){
                this.t += dt / this.seconds;
                this.setValueAt(this.easingfunction(clamp(this.t,0,1)));
    
                if(this.t >= 1){
                    if(this.nextChain){
                        E.Engine.effectHandler.addEffect(this.nextChain)
                        this.nextChain.active = true;
                        this.destroy_effect = true;
                    }
                }
            }
        })
    }


    // Easing function already applied
    abstract setValueAt(t: number): void;

    go(): this {
        this.active = true;
        return this
    }   

    stop(): this {
        this.active = false;
        return this;
    }

    restart(): this {
        this.t = 0;
        this.active = true;
        return this;
    }

    chain<T extends Tween<any>>(tween: T) {
        this.nextChain = tween;
        return this.nextChain
    } 

    // Sets the initial state
    from(value: T): this {
        this.initialValue = value;
        return this;
    }
    // Sets the final state
    to(value: T): this {
        this.finalValue = value;
        return this;
    }
}

// class NumberTween

export class ColorTween extends Tween<Color> {
    setValueAt(t: number): void {
        blend(this.initialValue, this.finalValue, t, this.object[this.property]);
    }
}    


export class VecTween extends Tween<Coordinate> {
    setValueAt(t: number): void {
        mix(this.initialValue, this.finalValue, t, this.object[this.property]);
    }
}




