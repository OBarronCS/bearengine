import { BearGame } from "./abstractengine";
import { AbstractEntity } from "./abstractentity";
import { EventHub, OnDelaySignal, OnIntervalSignal, PureSignal } from "./eventhub";

type BaseEntitySignals = {
    start: () => void;
    finish: () => void;
    update: (dt: number) => void;
    delay: () => void;
    interval: (lap: number) => void;
}

export class EntityEffect<T extends {}> extends AbstractEntity {

    state: T;

    constructor(state: T){
        super();
        this.state = state;
    }

    on_start = new PureSignal<() => void>();
    on_finish = new PureSignal<() => void>();

    on_update = new PureSignal<(dt: number) => void>();
    on_interval = new OnIntervalSignal();
    on_delay = new OnDelaySignal();

    update(dt: number): void {
        this.on_delay.update();
        this.on_interval.update();
        this.on_update.dispatch(dt);
    }

    override onAdd(){
        this.on_start.dispatch();
    }

    override onDestroy(){
        this.on_finish.dispatch();
    }

}

// export class Effect2<X extends {}> extends AbstractEntity<any> {

//     private startFunctions: (() => void)[] = [];
//     private updateFunctions: ((dt: number) => void)[] = [];
//     private finishFunctions:(() => void)[] = [];
    
//     private intervalFunctions: [number, (lap: number) => void, number, number][] = [];
//     private delayFunctions: ([number,() => void])[] = [];
    
//     ticks_alive = 0;

//     constructor(public bound: X){
//         super();
        
//     }
    
//     hasOnlyStart(): boolean {
//         return this.updateFunctions.length === 0 && this.finishFunctions.length === 0 && this.intervalFunctions.length === 0 && this.delayFunctions.length === 0;
//     }

//     onStart(func:((this:X) => void)): this {
//         const boundedFunc = func.bind(this.bound);
//         this.startFunctions.push(boundedFunc)
//         return this;
//     }
    
//     onUpdate(func: ((this:X, dt: number) => void)): this {
//         const boundedFunc = func.bind(this.bound);
//         this.updateFunctions.push(boundedFunc);
//         return this;
//     }
    
//     onFinish(func: (this:X) => void): this {
//         const boundedFunc = func.bind(this.bound);
//         this.finishFunctions.push(boundedFunc)
//         return this;
//     }

//     /// max_times = 0 does not work as of now... Just don't do that
//     onInterval(ticks: number, func: (this:X, lap: number) => void, max_times = -1): this {
//         const boundedFunc = func.bind(this.bound);
//         this.intervalFunctions.push([ticks, boundedFunc, 0, max_times]);
//         return this;
//     }
    
//     onDelay(ticks: number, func: (this:X) => void): this {
//         const boundedFunc = func.bind(this.bound);
//         this.delayFunctions.push([ticks, boundedFunc]);
//         return this;
//     }

//     destroyAfter(time: number){
//         this.onDelay(time, () => this.destroy());
//     }

//     override onAdd(){
//         for (let i = 0; i < this.startFunctions.length; ++i) {
//             this.startFunctions[i]();
//         }
//         if(this.hasOnlyStart()) this.destroy();
//     }

//     override onDestroy(){
//         for (let i = 0; i < this.finishFunctions.length; ++i) {
//             this.finishFunctions[i]();
//         }
//     }

//     update(dt: number): void {
//         this.ticks_alive += 1;
    
//         // functions that run after a delay!
//         for (let i = this.delayFunctions.length - 1; i >= 0; --i) {
//             const delayInfo = this.delayFunctions[i];
//             const time = delayInfo[0];
//             if(this.ticks_alive % time === 0){
//                 delayInfo[1]();
//                 this.delayFunctions.splice(i, 1)
//             }
//         }
        
//         // functions that run on an interval
//         for (let i = this.intervalFunctions.length - 1; i >= 0; --i) {
//             const intervalInfo = this.intervalFunctions[i];
//             const time = intervalInfo[0];
//             if(this.ticks_alive % time == 0){
//                 const func = intervalInfo[1];
//                 const num = intervalInfo[2];
//                 func(num);
//                 intervalInfo[2] = num + 1;
                
//                 const max_times = intervalInfo[3];
                
//                 if(max_times != -1 && max_times == num + 1){
//                     this.intervalFunctions.splice(i,1);
//                 }
//             }
//         }
        
//         for (let i = 0; i < this.updateFunctions.length; ++i) {
//             this.updateFunctions[i](dt);
//         }
        
//     }
// }




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



