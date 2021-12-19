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
    abstract update(dt: number): void;
    protected abstract onStart(): void;
    protected abstract onEnd(): void;

    initialize(){

        this.initSystems();

        for(const system of this.systems){
            system.init();
        }

        this.entities.registerSystems(this.systems);

        AbstractEntity["GAME_OBJECT"] = this;


        console.trace("HIIII");

        this.onStart();
    }

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }

    private scenes: BearScene<this>[] = [];

    protected updateScenes(dt: number){
        for(const scene of this.scenes){
            scene.update(dt);
        }
    }

    enable_scene(scene: BearScene<this>){
        this.scenes.push(scene);
        scene.on_enable();
        scene.enabled = true;
    }

    disable_scene(scene: BearScene<this>){
        let i: number;
        if((i = this.scenes.indexOf(scene)) != 0 ){
            this.scenes.splice(i,1);

            scene.on_disable();
        }
    }

    protected addScene<T extends BearScene<any>>(scene: T): T {
        this.scenes.push(scene);
        scene.init();
        return scene;
    }
}


export abstract class BearScene<TGame extends BearGame<any, any>> {
    
    enabled: boolean = false;

    constructor(public game: TGame){

    }

    abstract init(): void;
    abstract update(dt: number): void;
    abstract on_enable(): void;
    abstract on_disable(): void;
    // enable()
    // pause()
}


