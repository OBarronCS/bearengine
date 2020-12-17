import { Vec2 } from "../math-library/shapes/vec2";
import { E } from "./globals";
import { Player } from "../gamelogic/player";
import { Entity } from "./entity";
import { Sprite, Point } from "pixi.js";




export class EffectHandler {

    private effectsLog: string[] = [];
    private effects: Effect[] = [];


    update(dt: number){
        for(let i = this.effects.length - 1; i >= 0; --i){
            const effect = this.effects[i];
            effect.update(dt);

            if(effect.destroy_effect){
                effect.finish();
                this.effects.splice(i,1);
                this.effectsLog.push("Ended effect: " + effect.toString())
            }
        }
    }

    addEffect<T extends Effect>(effect: T): T{

        this.effectsLog.push("Started effect: " + effect.toString());
		effect.start();
		// Don't add it do the list if it only has a start callback
        if(effect.updateFunctions.length === 0 && effect.finishFunctions.length === 0 && effect.intervalFunctions.length === 0 && effect.delayFunctions.length === 0){
            
        } else {
			this.effects.push(effect);
		}
		return effect;
    }

    dispose(){
        this.effectsLog = [];
        this.effects = [];
    }

}


export class Effect {
	destroy_effect: boolean = false;

	startFunctions: (() => void)[] = [];
	updateFunctions: ((dt: number) => void)[] = [];
	finishFunctions:(() => void)[] = [];
	
	intervalFunctions: [number, (lap: number) => void, number, number][] = [];
	delayFunctions: ([number,() => void])[] = [];
	
	time_alive = 0;
	
	onStart(func:(() => void)){
		const boundedFunc = func.bind(this);
		this.startFunctions.push(boundedFunc)
	}
	
	onUpdate(func: ((dt: number) => void)){
		const boundedFunc = func.bind(this);
		this.updateFunctions.push(boundedFunc)
	}
	
	onFinish(func: () => void){
		const boundedFunc = func.bind(this);
		this.finishFunctions.push(boundedFunc)
	}

	/// max_times = 0 does not work as of now... Just don't do that
	onInterval(time: number, func: (lap: number) => void, max_times = -1){
		const boundedFunc = func.bind(this);
		this.intervalFunctions.push([time, boundedFunc, 0, max_times]);
	}
	
	onDelay(time: number, func:() => void){
		const boundedFunc = func.bind(this);
		this.delayFunctions.push([time, boundedFunc]);
	}

	destroyAfter(time: number){
		this.onDelay(time, () => this.destroy_effect = true);
	}

	start(){
		for (let i = 0; i < this.startFunctions.length; ++i) {
			this.startFunctions[i]();
		}
	}

	finish(){
		for (let i = 0; i < this.finishFunctions.length; ++i) {
		    this.finishFunctions[i]();
		}
	}
	
	update(dt: number){
		this.time_alive += 1;
	
		// functions that run after a delay!
		for (let i = this.delayFunctions.length - 1; i >= 0; --i) {
			const delayInfo = this.delayFunctions[i];
			const time = delayInfo[0];
			if(this.time_alive % time == 0){
				delayInfo[1]();
				this.delayFunctions.splice(i, 1)
			}
		}
		
		// functions that run on an interval
		for (let i = this.intervalFunctions.length - 1; i >= 0; --i) {
			const intervalInfo = this.intervalFunctions[i];
			const time = intervalInfo[0];
			if(this.time_alive % time == 0){
				const func = intervalInfo[1];
				const num = intervalInfo[2];
				func(num);
				intervalInfo[2] = num + 1;
				
				const max_times = intervalInfo[3];
				
				if(max_times != -1 && max_times == num + 1){
					this.intervalFunctions.splice(i,1);
				}
			}
		}
		
		for (let i = 0; i < this.updateFunctions.length; ++i) {
		    this.updateFunctions[i](dt);
		}
		
	}
}


