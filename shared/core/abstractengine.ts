import { Subsystem } from "./subsystem";

// P stands for "Parent"
// THINK: Can Generic be anything? Or just another state? If just another state, allows for some things like automatic parent context query getting. 
export abstract class BearState<P extends BearState<any>> {

    context: P;

    constructor(context: P){
        this.context = context;
    }

    abstract update(dt: number): void
    abstract onStart(): void;
    abstract onEnd(): void;


    systems: Subsystem[] = [];

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}

// A specific case of BearState, having no parent
export abstract class AbstractBearEngine extends BearState<undefined>{
    
    constructor(){
        super(undefined);
    }
}

// export abstract class AbstractBearEngine {
    
//     protected systems: Subsystem[] = [];
    
//     public registerSystem<T extends Subsystem>(system: T): T {
//         this.systems.push(system);
//         return system;
//     }
// }


