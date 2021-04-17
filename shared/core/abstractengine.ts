import { Subsystem } from "./subsystem";


export interface AbstractBearEngine {
    registerSystem<T extends Subsystem>(system: T): T
}


