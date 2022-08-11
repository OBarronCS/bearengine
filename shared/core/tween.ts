import { Color, blend } from "shared/datastructures/color";
import { clamp, lerp } from "shared/misc/mathutils";
import { Coordinate, mix } from "shared/shapes/vec2";
import { EffectEntity } from "./effects";

/** Easing functions */
export function ease(t: number){
    const sqt = t * t;
    return sqt / (2 * (sqt - t) + 1);
}

// from https://easings.net/
export function easeInOutExpo(x: number): number {
    return x === 0
      ? 0
      : x === 1
      ? 1
      : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2
      : (2 - Math.pow(2, -20 * x + 10)) / 2;
}


type KeysWithValueType<T, S> = {
    [Key in keyof T]: T[Key] extends S ? Key : never
}[keyof T]



function create_tween<T,P extends keyof T, V extends T[P]>
        (state: T, property:P){

}

interface TweenSettings<T> {
    duration_seconds: number,
    start: T,
    end: T,
}

export abstract class Tween<T,P extends KeysWithValueType<T, S>, S> extends EffectEntity<T> {
    
    public property: P


    public initialValue: S;
    public finalValue: S;


    public active = true;

    // the length of the tween
    public seconds: number;

    // How far into the tween we are, [0,1]
    public t = 0;
    public seconds_alive = 0;

    /** Seconds after GO that we wait until do anything.  */ 
    waitTime = 0;

    delay(time: number): this {
        this.waitTime = time;
        return this;
    }

    // Linear by default
    public easingfunction: (t: number) => number = t => t;


    repeat?: number
    loop?: boolean;
    pingpong?: boolean

    //onPingpong():
    //onRepeat()

    // set in chain function
    public nextChain: Tween<any,any,any>;

    constructor(obj: T, prop: P, settings: TweenSettings<S>){
        super(obj);

        this.property = prop;
        this.seconds = settings.duration_seconds;

        this.initialValue = settings.start;
        this.finalValue = settings.end;

        this.signals.on_update.add_handler((dt) => {
            if(this.active){
                this.seconds_alive += dt;

                if(this.seconds_alive >= this.waitTime){

                    this.t += dt / this.seconds;  
                    // this.t = (this.seconds_alive - this.waitTime) /  this.seconds;

                    this.setValueAt(this.easingfunction(clamp(this.t,0,1)));
    
                    if(this.t >= 1){

                        if(this.nextChain){
                            this.scene.addEntity(this.nextChain)
                            this.nextChain.active = true;
                        }

                        this.destroy();
                    }
                }
            }
        });
    }


    /** Easing function already applied */
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

    chain<T extends Tween<any,any,any>>(tween: T): T {
        this.nextChain = tween;
        return tween;
    }
}


export class NumberTween<T,P extends KeysWithValueType<T, number>> extends Tween<T,P,number> {
    setValueAt(t: number): void {
        //@ts-expect-error
        this.state[this.property] = lerp(this.initialValue, this.finalValue, t);
    }

}

export class ColorTween<T,P extends KeysWithValueType<T, Color>> extends Tween<T,P,Color> {
    setValueAt(t: number): void {
        //@ts-expect-error
        blend(this.initialValue, this.finalValue, t, this.state[this.property]);
    }
}    


export class VecTween<T,P extends KeysWithValueType<T, Coordinate>> extends Tween<T,P,Coordinate> {
    setValueAt(t: number): void {
        //@ts-expect-error
        mix(this.initialValue, this.finalValue, t, this.state[this.property]);
    }
}


/** A group of tweens */
class TweenSequence extends EffectEntity<{}> {

    constructor(){
        super({});
    }
    
    tweens: Tween<any,any,any>[] = [];

    override update(dt: number){
        super.update(dt);

        for(const tween of this.tweens){
            tween.update(dt);
        }
    }

    add_tween(tween: Tween<any,any,any>): this {
        this.tweens.push(tween);
        return this;
    }

} 


/** Single use */
class SequenceBuilder {

    private seq = new TweenSequence();
    
    private delay_ticks_acc = 0;

    add_tween(tween: Tween<any, any, any>): this {
        tween.delay(this.delay_ticks_acc);
        this.seq.add_tween(tween);
        return this;
    }

    add_function(cb: () => void): this {
        this.seq.signals.on_delay.add_handler({delay: this.delay_ticks_acc}, cb);
        return this;
    }

    wait_ticks(ticks: number): this {
        this.delay_ticks_acc += ticks;
        return this;
    }

    // wait_seconds(): this {

    //     return this;
    // }

    private _built = false;
    build(): TweenSequence {
        if(this._built) throw new Error("Can only build once");
        this._built = true;
        return this.seq;
    }
}

export function create_sequence(cb: (seq: SequenceBuilder) => void): TweenSequence {
    const builder = new SequenceBuilder();
    cb(builder);
    return builder.build();
}




const b = create_sequence(seq => {
    
    seq.add_function(() => {
        console.log("instant")
    });

    seq.wait_ticks(10);

    seq.add_tween(new NumberTween({"":3123},"",{
        duration_seconds: 1,
        start: 3123,
        end: 23
    }));

    seq.wait_ticks(120)

    seq.add_function(() => {
        console.log("hello! 120 ticks later");
    });

});
