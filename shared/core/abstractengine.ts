import { Subsystem } from "./subsystem";

export abstract class BearState<E extends {}> {

    engine: E;

    constructor(engine: E){
        this.engine = engine;
    }

    abstract update(dt: number): void;
    abstract onStart(): void;
    abstract onEnd(): void;

    
    systems: Subsystem[] = [];

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}


export abstract class AbstractBearEngine extends BearState<undefined>{
    
  
}

// export abstract class AbstractBearEngine {
    
//     protected systems: Subsystem[] = [];
    
//     public registerSystem<T extends Subsystem>(system: T): T {
//         this.systems.push(system);
//         return system;
//     }
// }


