import { Subsystem } from "./subsystem";


export interface AbstractBearEngine {
    registerSystem<T extends Subsystem>(system: T): T
    getSystem<T extends Subsystem>(query: new(...args: any[]) => T): T 
}


