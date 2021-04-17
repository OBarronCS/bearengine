import { Subsystem } from "./subsystem";


// There's really no point in making it abstract, just signifies that it's meant to be subclassed
export abstract class AbstractBearEngine {
    
    protected systems: Subsystem[] = [];
    
    public registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}


