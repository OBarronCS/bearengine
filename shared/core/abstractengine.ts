import { AbstractEntity } from "./abstractentity";
import { EntitySystem } from "./entitysystem";
import { Subsystem } from "./subsystem";



export abstract class BearGame<TEngine extends {}, TEntity extends AbstractEntity = AbstractEntity> {

    systems: Subsystem[] = [];

    engine: TEngine;

    entities: EntitySystem<TEntity>;

    constructor(engine: TEngine){
        this.engine = engine;
        this.entities = this.registerSystem(new EntitySystem(this));
    }

    protected abstract initSystems(): void;

    initialize(){

        this.initSystems();

        for(const system of this.systems){
            system.init();
        }

        this.entities.registerSystems(this.systems);

        AbstractEntity["GAME_OBJECT"] = this;



        this.onStart();
    }

    abstract update(dt: number): void;
    protected abstract onStart(): void;
    protected abstract onEnd(): void;

    
    
    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
}


