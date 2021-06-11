import { Subsystem } from "./subsystem";


export abstract class AbstractBearEngine {
    
    protected systems: Subsystem[] = [];
    
    public registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}


