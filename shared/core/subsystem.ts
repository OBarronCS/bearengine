import { Attribute, AttributeQuery} from "shared/core/entityattribute";
import { BearGame } from "./abstractengine";
import { EventRegistry } from "./bearevents";
import { BearEvents } from "./sharedlogic/eventdefinitions";

// new(engine: BearEngine) => T

// Optional type override for more flexibility, for server/client specific subsystems
export abstract class Subsystem<TGame extends BearGame<any> = BearGame<{}>> {
    
    public queries: AttributeQuery<any>[] = [];
    public eventHandlers: EventRegistry<keyof BearEvents>[] = [];

    public game: TGame;
    public engine: TGame["engine"]
    constructor(game: TGame){
        this.game = game;
        this.engine = game.engine;
    }

    abstract init(): void;
    abstract update(delta: number): void;

    addEventDispatcher<T extends keyof BearEvents>(name: T): EventRegistry<T> {
        const eg = new EventRegistry(name);
        this.eventHandlers.push(eg);
        return eg;
    }

    addQuery<T extends Attribute>(
                partClass: new(...args:any[]) => T,
                onAdd: (part: T) => void = (a) => {},
                onRemove: (part: T) => void = (a) => {},
            ): AttributeQuery<T> {

        const q = new AttributeQuery(partClass,onAdd,onRemove);
        this.addQueryCheckNoDuplicates(q);
        return q;
    }

    addExistingQuery<T extends Attribute>(q: AttributeQuery<T>): AttributeQuery<T> {
        this.addQueryCheckNoDuplicates(q);
        return q;
    }

    // Only checks for same object itself. Will not add if already here. For debugging
    private addQueryCheckNoDuplicates<T extends Attribute>(q: AttributeQuery<T>): AttributeQuery<T> {
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

