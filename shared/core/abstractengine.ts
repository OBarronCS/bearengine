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

        this.onStart();
    }

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }

    private iterated_scenes: BearScene<any>[] = [];

    protected updateScenes(dt: number){
        for(const scene of this.iterated_scenes){
            scene.update(dt);
        }
    }

    // Adds it to the list of scenes being iterated
    enable_scene(scene: BearScene<any>){
        this.iterated_scenes.push(scene);
        scene.on_enable();
        scene.enabled = true;
    }

    disable_scene(scene: BearScene<any>){
        let i: number;
        if((i = this.iterated_scenes.indexOf(scene)) !== -1 ){
            this.iterated_scenes.splice(i,1);

            scene.on_disable();
        }
    }

    protected addScene<T extends BearScene<any>>(scene: T): T {
        // this.scenes.push(scene);
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
    // Called EVERY TIME the scene is enabled.
    abstract on_enable(): void;
    abstract on_disable(): void;
    // enable()
    // pause()
}


