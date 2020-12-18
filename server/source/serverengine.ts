


import { EffectHandler } from "client/src/app/core-engine/effecthandler";
import { Entity } from "client/src/app/core-engine/entity";
import { LevelHandler } from "client/src/app/core-engine/level";


import { CustomMapFormat } from "./core/tiledmapeditor";
import { SE } from "./serverglobal";


let lastFrameTimeMs = 0;
let maxFPS = 60;
let accumulated = 0;
let simulation_time = 1000 / maxFPS;


class ServerBearEngine {
    // Total simulated time, in seconds
    public totalTime = 0;

    // Things that should be globally accessible by ServerE
    private current_level: LevelHandler = null;

    public effectHandler = new EffectHandler();

    private updateList: Entity[] = [];


    constructor(){
        SE.Engine = this;
    }


	startLevel(level_struct: CustomMapFormat){
		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();

        SE.Level = this.current_level;
        SE.Terrain = this.current_level.terrainManager;
        SE.Collision = this.current_level.collisionManager;
    }


    start(){
        (this.loop.bind(this))()
    }

    // Need to load the game files. Create Abstraction for that 
    // async preload(): Promise<>{
    //     return new Promise((resolve) => this.renderer.initTextures(ALL_TEXTURES, () => {
    //         resolve(RESOURCES)
    //     }));
    // }

    destroyEntity(e: Entity): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            this.updateList.splice(index,1);
            e.parts.forEach(part => part.onRemove());
        }
    }

    addEntity(e: Entity): Entity {
        this.updateList.push(e);
        return e;
    }
   

    loop(timestamp: number = performance.now()){
        accumulated += timestamp - lastFrameTimeMs;

      
        lastFrameTimeMs = timestamp;
        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(accumulated > 1000){
            accumulated = 0;
        }

        // both of these are in ms
        while (accumulated >= (simulation_time)) {

            // divide by 1000 to get seconds
            const dt = simulation_time / 1000;



            this.current_level.collisionManager.update(dt);

            
            for (let i = 0; i < this.updateList.length; i++) {
                const entity = this.updateList[i];
                entity.update(dt);
                entity.postUpdate();
                entity.updateParts(dt);
            }

            this.effectHandler.update(dt);

            this.totalTime += dt;
            accumulated -= simulation_time;
        }
    }

    restartCurrentLevel(){
        const data = this.current_level.data_struct;
        this.endCurrentLevel();
        this.startLevel(data);
    }

    endCurrentLevel(){
        this.current_level.end();

        for(let i = this.updateList.length - 1; i >= 0; --i){
            this.destroyEntity(this.updateList[i]);
        }
    }   

}


export {
    ServerBearEngine,
}