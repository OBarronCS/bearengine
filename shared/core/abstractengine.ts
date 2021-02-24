import { Subsystem } from "./subsystem";



// Interface for now so I can deal with other things faster
export interface AbstractBearEngine {


    registerSystem<T extends Subsystem>(system: T): T
    getSystem<T extends Subsystem>(query: new(...args: any[]) => T): T 

}


