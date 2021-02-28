
import { EngineMouse } from "../input/mouse";
import { GUI } from "dat.gui";
import { RendererSystem } from "./renderer";
import { CameraSystem } from "./camera";
import { EventEmitter } from "eventemitter3";
import TypedEmitter from "typed-emitter";
import { Entity, GMEntity, SpriteEntity } from "./entity";
import { EngineKeyboard } from "../input/keyboard";
import { loadTestLevel } from "../gamelogic/testlevelentities";
import { BufferedNetwork } from "./networking/socket";

import { CustomMapFormat, ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { Graphics, Loader, utils, Sprite } from "pixi.js";
import { AbstractEntity } from "shared/core/abstractentity";
import { Subsystem } from "shared/core/subsystem";

import { Vec2 } from "shared/shapes/vec2";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { NetworkReadSystem } from "./networking/networkread";
import { NetworkWriteSystem } from "./networking/networkwrite";
import { ClientScene } from "./clientscene";
import { BearEvents, EventRegistry } from "../../../../shared/core/bearevents";
import { TestMouseDownEventDispatcher } from "./testevents";


const SHARED_RESOURCES = Loader.shared.resources;
const SHARED_LOADER = Loader.shared;

let lastFrameTimeMs = 0;
let accumulated = 0;
const maxFPS = 60;
const simulation_time = 1000 / maxFPS;

// Returns names of files!
// r is the require function
function importAll(r: any): [] {
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}
const images = importAll(require.context('../../images', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES: string[] = images.slice(0);
console.log(ALL_TEXTURES)


export interface CoreEvents {}


export class BearEngine implements AbstractBearEngine {

    public networkconnection: BufferedNetwork = new BufferedNetwork("ws://127.0.0.1:8080");

    




    // IMPORTANT SYSTEMS
    public networksystem: NetworkReadSystem = null;
    public renderer: RendererSystem = null;
    public camera: CameraSystem = null;
    public mouse: EngineMouse = null;
    public keyboard: EngineKeyboard = null;
    public level: LevelHandler = null;
    public entityManager: ClientScene = null;
    

    private systems: Subsystem[] = [];

    public systemEventMap: Map<keyof BearEvents, EventRegistry<keyof BearEvents>> = new Map();


    public levelGraphic = new Graphics();

    // Total simulated time, in seconds
    public totalTime = 0;


    // DOES NOT start ticking yet
    init(): void {
        const div = document.querySelector("#display") as HTMLElement;
            
        //Order of registering = order of tick 

        this.networksystem = this.registerSystem(new NetworkReadSystem(this, this.networkconnection));

        this.mouse = this.registerSystem(new EngineMouse(this));
        this.keyboard = this.registerSystem(new EngineKeyboard(this));
        this.camera = this.registerSystem(new CameraSystem(this));
        this.level = this.registerSystem(new LevelHandler(this));

        // For testing
        this.registerSystem(new TestMouseDownEventDispatcher(this))

        this.entityManager = this.registerSystem(new ClientScene(this))

        this.registerSystem(new NetworkWriteSystem(this, this.networkconnection))

        this.renderer = this.registerSystem(new RendererSystem(this, div, window));


        for(const system of this.systems){
            system.init();
        }

        for(const system of this.systems){
            for(const handler of system.eventHandlers){
                this.systemEventMap.set(handler.eventName, handler);
            }
        }

        this.keyboard.bind("k", () => {
            this.restartCurrentLevel()
        })
    }

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }

    /** Takes in class name, returns instance of it */
    getSystem<T extends Subsystem>(query: new(...args: any[]) => T): T {
        const name = query.name;
        for(const system of this.systems){
            // @ts-expect-error
            if(system.constructor.name === name) return system;
        }

        return null;
    }

    startLevel(level_struct: CustomMapFormat){
        // janky. This call to level adds a part query to the level handler.        
        this.level.load(level_struct);

        this.entityManager.registerPartQueries(this.systems);

        
        this.renderer.renderer.backgroundColor = utils.string2hex(level_struct.world.backgroundcolor);
       
        // Load sprites from map 
        level_struct.sprites.forEach(s => {
            const sprite = new Sprite(this.renderer.getTexture("images/" + s.file_path));
            sprite.x = s.x;
            sprite.y = s.y;
            sprite.width = s.width;
            sprite.height = s.height;
            this.renderer.addSprite(sprite)
        });

        // Global Data
        // @ts-expect-error
        AbstractEntity.GLOBAL_DATA_STRUCT = {
            Scene:this.entityManager,
            Level:this.level,
            Collision:this.level.collisionManager,
            Terrain:this.level.terrainManager,
        }

        Entity.BEAR_ENGINE = this;
        
        this.levelGraphic = new Graphics();
        this.redrawLevel();
        this.renderer.addSprite(this.levelGraphic);

        loadTestLevel.call(this.entityManager);
        
        // this.camera["center"].set(this.player.position);
        this.camera.zoom(Vec2.HALFHALF)
        // this.camera.follow(this.player.position)
    }

    public redrawLevel(){
        this.levelGraphic.clear();
        this.level.draw(this.levelGraphic);
    }

    // Loads all assets from server
    async loadAssets(): Promise<typeof SHARED_RESOURCES>{
        return new Promise( (resolve) => {

            SHARED_LOADER.add(ALL_TEXTURES);
    
            SHARED_LOADER.load(() => {
                console.log('PIXI.Loader.shared.resources :>> ', SHARED_RESOURCES);
                resolve(SHARED_RESOURCES);
            });
        });
    }

    /** Starts main loop. Connects to server */
    start(){
        if(this.renderer === null) console.error("RENDERER NOT INITIALIZED");

        this.networkconnection.connect();

        (this.loop.bind(this))();
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

            for(const system of this.systems){
                system.update(dt);
            }

            this.totalTime += dt;
            accumulated -= simulation_time;
        }
        
        //console.log(performance.now() - timestamp)        

        requestAnimationFrame(t => this.loop(t))
    }

    restartCurrentLevel(){
        const data = this.level.data_struct;
        this.endCurrentLevel();
        this.startLevel(data);
    }

    endCurrentLevel(){
        console.log("Ending level")
        this.level.end();

        this.entityManager.clear();

        const children = this.renderer.mainContainer.removeChildren();
        // This is crucial --> otherwise there is a memory leak
        children.forEach(child => child.destroy())
    }   

}




