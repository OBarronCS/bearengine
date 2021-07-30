import { AbstractEntity } from "./abstractentity";
import { EntitySystem } from "./entitysystem";
import { Subsystem } from "./subsystem";



export abstract class BearGame<TEngine extends {}> {

    engine: TEngine;

    entities: EntitySystem = this.registerSystem(new EntitySystem(this))

    constructor(engine: TEngine){
        this.engine = engine;
    }

    initialize(){

        this.onStart();

        for(const system of this.systems){
            system.init();
        }

        this.entities.registerSystems(this.systems);

        AbstractEntity["ENGINE_OBJECT"] = this;
    }

    abstract update(dt: number): void;
    protected abstract onStart(): void;
    protected abstract onEnd(): void;

    
    systems: Subsystem[] = [];

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}


// export abstract class AbstractBearEngine {
    
//     protected systems: Subsystem[] = [];
    
//     public registerSystem<T extends Subsystem>(system: T): T {
//         this.systems.push(system);
//         return system;
//     }
// }


