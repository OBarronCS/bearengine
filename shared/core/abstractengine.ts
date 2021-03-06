import { EventRegistry } from "./bearevents";
import { BearEvents } from "./sharedlogic/eventdefinitions";
import { Subsystem } from "./subsystem";


export interface AbstractBearEngine {
    systemEventMap: Map<keyof BearEvents, EventRegistry<keyof BearEvents>>;

    registerSystem<T extends Subsystem>(system: T): T
    getSystem<T extends Subsystem>(query: new(...args: any[]) => T): T 

}


