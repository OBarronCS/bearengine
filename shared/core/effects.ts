import { BearGame } from "./abstractengine";
import { AbstractEntity } from "./abstractentity";

// USE: Subclass, or provide functions in 'on' functions!
export class Effect<T extends BearGame<any> = BearGame<{}>> extends AbstractEntity<T> {

	private startFunctions: (() => void)[] = [];
	private updateFunctions: ((dt: number) => void)[] = [];
	private finishFunctions:(() => void)[] = [];
	
	private intervalFunctions: [number, (lap: number) => void, number, number][] = [];
	private delayFunctions: ([number,() => void])[] = [];
	
	ticks_alive = 0;
	
	hasOnlyStart(): boolean {
		return this.updateFunctions.length === 0 && this.finishFunctions.length === 0 && this.intervalFunctions.length === 0 && this.delayFunctions.length === 0;
	}

	onStart(func:((this:this) => void)): this {
		const boundedFunc = func.bind(this);
		this.startFunctions.push(boundedFunc)
		return this;
	}
	
	onUpdate(func: ((this:this, dt: number) => void)): this {
		const boundedFunc = func.bind(this);
		this.updateFunctions.push(boundedFunc);
		return this;
	}
	
	onFinish(func: (this:this) => void): this {
		const boundedFunc = func.bind(this);
		this.finishFunctions.push(boundedFunc)
		return this;
	}

	/// max_times = 0 does not work as of now... Just don't do that
	onInterval(ticks: number, func: (this:this, lap: number) => void, max_times = -1): this {
		const boundedFunc = func.bind(this);
		this.intervalFunctions.push([ticks, boundedFunc, 0, max_times]);
		return this;
	}
	
	onDelay(ticks: number, func: (this:this) => void): this {
		const boundedFunc = func.bind(this);
		this.delayFunctions.push([ticks, boundedFunc]);
		return this;
	}

	destroyAfter(time: number){
		this.onDelay(time, () => this.destroy());
	}

	override onAdd(){
		for (let i = 0; i < this.startFunctions.length; ++i) {
			this.startFunctions[i]();
		}
		if(this.hasOnlyStart()) this.destroy();
	}

	override onDestroy(){
		for (let i = 0; i < this.finishFunctions.length; ++i) {
		    this.finishFunctions[i]();
		}
	}

	update(dt: number): void {
		this.ticks_alive += 1;
	
		// functions that run after a delay!
		for (let i = this.delayFunctions.length - 1; i >= 0; --i) {
			const delayInfo = this.delayFunctions[i];
			const time = delayInfo[0];
			if(this.ticks_alive % time === 0){
				delayInfo[1]();
				this.delayFunctions.splice(i, 1)
			}
		}
		
		// functions that run on an interval
		for (let i = this.intervalFunctions.length - 1; i >= 0; --i) {
			const intervalInfo = this.intervalFunctions[i];
			const time = intervalInfo[0];
			if(this.ticks_alive % time == 0){
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


