import { AbstractEntity } from "./abstractentity";
import { OnDelaySignal, OnIntervalSignal, PureSignal } from "./eventhub";

type IBaseEntitySignals = {
    start: () => void;
    finish: () => void;
    update: (dt: number) => void;
    delay: () => void;
    interval: (lap: number) => void;
}



export class BaseEntitySignals {

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

    start(){
        this.on_start.dispatch();
    }

    end(){
        this.on_finish.dispatch();
    }


}

/** 
 * An entity wrapper around base entity signals
 * Use case is NOT to subclass, but to instantiate it some with passed in state.
 */
export class EffectEntity<T extends {}> extends AbstractEntity {

    public signals = new BaseEntitySignals();
    
    state: T;

    ticks_alive = 0;

    constructor(state: T){
        super();
        this.state = state;
    }

    update(dt: number): void {
        this.ticks_alive++;
        this.signals.update(dt);
    }

    override onAdd(){
        this.signals.start();
    }

    override onDestroy(){
        this.signals.end();
    }

    destroyAfter(time: number){
        this.signals.on_delay.add_handler({ delay: time }, () => this.destroy());
    }

}

