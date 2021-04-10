
import { Graphics, Loader, Sprite } from "pixi.js";
// import { GUI } from "dat.gui";

import { AbstractBearEngine } from "shared/core/abstractengine";
import { AbstractEntity } from "shared/core/abstractentity";
import { EventRegistry } from "shared/core/bearevents";
import { LevelHandler } from "shared/core/level";
import { Scene } from "shared/core/scene";
import { BearEvents } from "shared/core/sharedlogic/eventdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { Vec2 } from "shared/shapes/vec2";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";
import { string2hex } from "shared/mathutils";

import { loadTestLevel } from "../gamelogic/testlevelentities";
import { EngineKeyboard } from "../input/keyboard";
import { EngineMouse } from "../input/mouse";
import { CameraSystem } from "./camera";
import { Entity } from "./entity";
import { NetworkSystem } from "./networking/networksystem";
import { BufferedNetwork } from "./networking/clientsocket";
import { RendererSystem } from "./renderer";
import { TestMouseDownEventDispatcher } from "./mouseevents";



const SHARED_RESOURCES = Loader.shared.resources;
const SHARED_LOADER = Loader.shared;

const ASSET_FOLDER_NAME = "assets/";

// Returns names of files!
// r is the require function
function importAll(r: any): [] {
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}

// This cannot take variable for path because it just doesn't work...
const images = importAll(require.context('../../assets', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES: string[] = images.slice(0);
console.log(ALL_TEXTURES)

const maxFPS = 60;
const simulation_time = 1000 / maxFPS;

export class BearEngine implements AbstractBearEngine {

    public tick = 0;
    private lastFrameTimeMs = 0;
    private accumulated = 0;
    public totalTime = 0;


    public networkconnection: BufferedNetwork = new BufferedNetwork({ port: 80 });


    // Subsystems
    public networksystem: NetworkSystem;
    public renderer: RendererSystem;
    public camera: CameraSystem;
    public mouse: EngineMouse;
    public keyboard: EngineKeyboard;
    public level: LevelHandler;
    public entityManager: Scene;
    public terrain: TerrainManager;
    public collisionManager: CollisionManager;


    private systems: Subsystem[] = [];
    public systemEventMap: Map<keyof BearEvents, EventRegistry<keyof BearEvents>> = new Map();


    init(): void {
        const div = document.querySelector("#display") as HTMLElement;

        // Register order matters due to dependencies
        this.networksystem = this.registerSystem(new NetworkSystem(this, this.networkconnection));
        

        this.mouse = this.registerSystem(new EngineMouse(this));
        this.keyboard = this.registerSystem(new EngineKeyboard(this));
        this.camera = this.registerSystem(new CameraSystem(this));


        this.level = this.registerSystem(new LevelHandler(this));


        this.terrain = this.registerSystem(new TerrainManager(this));
        this.collisionManager = this.registerSystem(new CollisionManager(this));

        this.entityManager = this.registerSystem(new Scene(this))
        
        // For testing
        this.registerSystem(new TestMouseDownEventDispatcher(this))

        
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

    loadLevel(levelData: CustomMapFormat){
        if(this.level.loaded) throw new Error("TRYING TO LOAD A LEVEL WHEN ONE IS ALREADY LOADED");
        
        this.level.startLevel(levelData);

        this.entityManager.registerPartQueries(this.systems);

        this.renderer.renderer.backgroundColor = string2hex(levelData.world.backgroundcolor);
       
        // Load sprites from map 
        levelData.sprites.forEach(s => {
            const sprite = new Sprite(this.renderer.getTexture(ASSET_FOLDER_NAME + s.file_path));
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
            Collision:this.collisionManager,
            Terrain:this.terrain,
        }

        Entity.BEAR_ENGINE = this;
        
        this.terrain.graphics = new Graphics();
        this.terrain.queueRedraw();
        this.renderer.addSprite(this.terrain.graphics);

        loadTestLevel.call(this.entityManager);


        // this.camera["center"].set(this.player.position);
        this.camera.left = 0;
        this.camera.top = 0;
        this.camera.zoom({x:.2,y:.2});
        // this.camera.follow(this.player.position)
    }

    endCurrentLevel(){
        console.log("Ending level")
        this.level.end();

        this.entityManager.clear();
        this.terrain.clear();
        this.collisionManager.clear()

        const children = this.renderer.mainContainer.removeChildren();
        // This is crucial --> otherwise there is a memory leak
        children.forEach(child => child.destroy());


        this.level.loaded = false;
    }   

    restartCurrentLevel(){
        const data = this.level.data_struct;
        this.endCurrentLevel();
        this.loadLevel(data);
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


    getResource(path: string) {
        const fullPath = ASSET_FOLDER_NAME + path;
        const data = SHARED_RESOURCES[fullPath];

        if(data === undefined) throw new Error("Trying to get a resource that we don't have, " + path);
        
        return data;
    }

    private _boundloop = this.loop.bind(this);

    loop(timestamp: number = performance.now()){
        this.accumulated += timestamp - this.lastFrameTimeMs;
        this.lastFrameTimeMs = timestamp;

        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(this.accumulated > 1000){
            this.accumulated = 0;
        }
        
        // both of these are in ms
        while (this.accumulated >= (simulation_time)) {
            // divide by 1000 to get seconds
            const dt = simulation_time / 1000;


            this.networksystem.readPackets();


            this.mouse.update();
            this.keyboard.update();
            this.camera.update(dt);
            this.level.update(dt);

            this.terrain.update(dt);
            this.collisionManager.update(dt);

            this.entityManager.update(dt);


            this.networksystem.writePackets();



            this.tick++;
            this.totalTime += dt;
            this.accumulated -= simulation_time;
        }
        
       
        // console.log(performance.now() - timestamp) 

        this.renderer.update();

               

        requestAnimationFrame(this._boundloop);
    }

}




