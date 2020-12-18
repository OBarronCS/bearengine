


import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { ServerEntity } from "./serverentity";

import { DRAW_TEST } from "shared/pixitest";
console.log(DRAW_TEST)

import { SE } from "./serverglobal";
import { EffectHandler } from "shared/core/effecthandler"
import { LevelHandler } from "shared/core/level";
console.log(LevelHandler)

import { ServerNetwork } from "./networking/serversocket";


class ServerBearEngine {
    // Total simulated time, in seconds
    public totalTime = 0;

    public network: ServerNetwork = null;


    public TICK_RATE: number;

    // Things that should be globally accessible by SE
    private current_level: LevelHandler = null;
    public effectHandler = new EffectHandler();

    private updateList: ServerEntity[] = [];


    private previousTick: number = 0;

    constructor(tick_rate: number){
        this.TICK_RATE = tick_rate;
        SE.Engine = this;
    }
    
    start(port: number){
        this.network = new ServerNetwork(this.TICK_RATE,port)
        this.previousTick = Date.now();
        this.loop();
    }

	startLevel(level_struct: CustomMapFormat){
		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();

        SE.Level = this.current_level;
        SE.Terrain = this.current_level.terrainManager;
        SE.Collision = this.current_level.collisionManager;
    }

    // Need to load the game files. Create Abstraction for that 
    // async preload(): Promise<>{
    //     return new Promise((resolve) => this.renderer.initTextures(ALL_TEXTURES, () => {
    //         resolve(RESOURCES)
    //     }));
    // }

    private _boundLoop = this.loop.bind(this);

    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if (this.previousTick + (1000 / this.TICK_RATE) <= now) {
            console.log(now - this.previousTick);
        
            this.network.sendGameData(now);
    
            this.previousTick = now
        }
    
        // if we are more than 16 milliseconds away from the next tick
        if(now - this.previousTick < (1000 / this.TICK_RATE) - 16) {
            setTimeout(  this._boundLoop  ) // sloppy timer
        } else {
            setImmediate( this._boundLoop  ) // ultra accurate method
        }
    }
   
    // dt, in terms of seconds
    update(dt: number){
        this.current_level.collisionManager.update(dt);
        
        for (let i = 0; i < this.updateList.length; i++) {
            const entity = this.updateList[i];
            entity.update(dt);
            entity.postUpdate();
            entity.updateParts(dt);
        }

        this.effectHandler.update(dt);
        this.totalTime += dt;
    }

    destroyEntity(e: ServerEntity): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            this.updateList.splice(index,1);
            e.parts.forEach(part => part.onRemove());
        }
    }

    addEntity(e: ServerEntity): ServerEntity {
        this.updateList.push(e);
        return e;
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

/*
const TICK_RATE = 20;

const engine = new ServerNetwork(TICK_RATE,8080);
// Opens it up to connections
engine.start();


let previousTick = Date.now();

function gameLoop(){
    const now = Date.now();

    // If we have made it far enough to TICK THE GAME
    if (previousTick + (1000 / TICK_RATE) <= now) {
        // console.log(now - previousTick);
    
        engine.sendGameData(now);

        previousTick = now
    }

    // if we are more than 16 milliseconds away from the next tick
    if(now - previousTick < (1000 / TICK_RATE) - 16) {
        setTimeout(gameLoop) // sloppy timer
    } else {
        setImmediate(gameLoop) // ultra accurate method
    }
}

gameLoop();
*/