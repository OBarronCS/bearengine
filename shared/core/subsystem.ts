import { AbstractBearEngine } from "shared/core/abstractengine";
import { Part } from "shared/core/abstractpart";
import { PartQuery } from "shared/core/partquery";
import { BearEvents, EventRegistry } from "./bearevents";



// new(engine: BearEngine) => T

// Optional type override for more flexibility, for server/client specific subsystems
export abstract class Subsystem<EngineType extends AbstractBearEngine = AbstractBearEngine> {
    public queries: PartQuery<any>[] = [];

    public eventHandlers: EventRegistry<keyof BearEvents>[] = [];

    public engine: EngineType;
    constructor(engine: EngineType){
        this.engine = engine;
    }

    abstract init(): void;
    abstract update(delta: number): void;

    getSystem<T extends Subsystem>(query: new(...args: any[]) => T): T {
        return this.engine.getSystem(query);
    }

    addEventDispatcher<T extends keyof BearEvents>(name: T): EventRegistry<T> {
        const eg = new EventRegistry(name);
        this.eventHandlers.push(eg);
        return eg;
    }

    addQuery<T extends Part>(
                partClass: new(...args:any[]) => T,
                onAdd: (part: T) => void = (a) => {},
                onRemove: (part: T) => void = (a) => {},
            ): PartQuery<T> {

        const q = new PartQuery(partClass,onAdd,onRemove);
        this.addQueryCheckNoDuplicates(q);
        return q;
    }

    addExistingQuery<T extends Part>(q: PartQuery<T>): PartQuery<T> {
        this.addQueryCheckNoDuplicates(q);
        return q;
    }

    // Only checks for same object itself. Will not add if already here. For debugging
    private addQueryCheckNoDuplicates<T extends Part>(q: PartQuery<T>): PartQuery<T> {
        for(const query of this.queries){
            if(q === query) { 
                console.trace("Error! Trying to add same query twice!")
                return q;
            }
        }
        this.queries.push(q);
        return q;
    }

}

