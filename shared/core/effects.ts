import { AbstractBearEngine } from "./abstractengine";
import { AbstractEntity } from "./abstractentity";

// USE: Subclass, or provide functions in 'on' functions!
export class Effect<T extends AbstractBearEngine = AbstractBearEngine> extends AbstractEntity<T> {

	private startFunctions: (() => void)[] = [];
	private updateFunctions: ((dt: number) => void)[] = [];
	private finishFunctions:(() => void)[] = [];
	
	private intervalFunctions: [number, (lap: number) => void, number, number][] = [];
	private delayFunctions: ([number,() => void])[] = [];
	
	time_alive = 0;
	
	hasOnlyStart(): boolean {
		return this.updateFunctions.length === 0 && this.finishFunctions.length === 0 && this.intervalFunctions.length === 0 && this.delayFunctions.length === 0;
	}

	onStart(func:((this:this) => void)){
		const boundedFunc = func.bind(this);
		this.startFunctions.push(boundedFunc)
	}
	
	onUpdate(func: ((this:this, dt: number) => void)){
		const boundedFunc = func.bind(this);
		this.updateFunctions.push(boundedFunc)
	}
	
	onFinish(func: (this:this) => void){
		const boundedFunc = func.bind(this);
		this.finishFunctions.push(boundedFunc)
	}

	/// max_times = 0 does not work as of now... Just don't do that
	onInterval(time: number, func: (this:this, lap: number) => void, max_times = -1){
		const boundedFunc = func.bind(this);
		this.intervalFunctions.push([time, boundedFunc, 0, max_times]);
	}
	
	onDelay(time: number, func: (this:this) => void){
		const boundedFunc = func.bind(this);
		this.delayFunctions.push([time, boundedFunc]);
	}

	destroyAfter(time: number){
		this.onDelay(time, () => this.destroySelf());
	}

	onAdd(){
		for (let i = 0; i < this.startFunctions.length; ++i) {
			this.startFunctions[i]();
		}
		if(this.hasOnlyStart()) this.destroySelf();
	}

	onDestroy(){
		for (let i = 0; i < this.finishFunctions.length; ++i) {
		    this.finishFunctions[i]();
		}
	}

	// To avoid override
	readonly update = (dt: number): void => {
		this.time_alive += 1;
	
		// functions that run after a delay!
		for (let i = this.delayFunctions.length - 1; i >= 0; --i) {
			const delayInfo = this.delayFunctions[i];
			const time = delayInfo[0];
			if(this.time_alive % time === 0){
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


