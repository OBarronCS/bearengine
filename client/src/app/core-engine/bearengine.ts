
import { Graphics, Loader, Sprite } from "pixi.js";
// import { GUI } from "dat.gui";

import { AbstractBearEngine } from "shared/core/abstractengine";
import { AbstractEntity } from "shared/core/abstractentity";
import { Scene } from "shared/core/scene";
import { Subsystem } from "shared/core/subsystem";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";
import { string2hex } from "shared/mathutils";

import { loadTestLevel } from "../gamelogic/testlevelentities";
import { EngineKeyboard } from "../input/keyboard";
import { EngineMouse } from "../input/mouse";
import { CameraSystem } from "./camera";
import { NetworkSystem } from "./networking/networksystem";
import { RendererSystem } from "./renderer";
import { TestMouseDownEventDispatcher } from "./mouseevents";
import { Rect } from "shared/shapes/rectangle";



const SHARED_RESOURCES = Loader.shared.resources;
const SHARED_LOADER = Loader.shared;

const ASSET_FOLDER_NAME = "assets/";

// Returns names of files!
// r is the require function
function importAll(r: any): [] {
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}

// This cannot take variable for path, webpack needs string literal for it to work ...
const images = importAll(require.context('../../assets', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES: string[] = images.slice(0);
console.log("Assets: " + ALL_TEXTURES)

const maxFPS = 60;
const simulation_time = 1000 / maxFPS;

export class BearEngine implements AbstractBearEngine {

    public tick = 0;
    private lastFrameTimeMs = 0;
    private accumulated = 0;
    public totalTime = 0;

    public paused = false;


    // Subsystems
    public networksystem: NetworkSystem;
    public renderer: RendererSystem;
    public camera: CameraSystem;
    public mouse: EngineMouse;
    public keyboard: EngineKeyboard;
    public entityManager: Scene;
    public terrain: TerrainManager;
    public collisionManager: CollisionManager;

    private mouseEventDispatcher: TestMouseDownEventDispatcher;

    private systems: Subsystem[] = [];


    public currentLevelData: CustomMapFormat;
    public levelbbox: Rect;
    public levelLoaded = false;


    init(): void {
        const div = document.querySelector("#display") as HTMLElement;

        // Register order matters due to dependencies
        this.networksystem = this.registerSystem(new NetworkSystem(this, { port: 80 }));
        

        this.mouse = this.registerSystem(new EngineMouse(this));
        this.keyboard = this.registerSystem(new EngineKeyboard(this));
        this.camera = this.registerSystem(new CameraSystem(this));



        this.terrain = this.registerSystem(new TerrainManager(this));
        this.collisionManager = this.registerSystem(new CollisionManager(this));

        this.entityManager = this.registerSystem(new Scene(this))
        
        // For testing
        this.mouseEventDispatcher = this.registerSystem(new TestMouseDownEventDispatcher(this))

        
        this.renderer = this.registerSystem(new RendererSystem(this, div, window));



        for(const system of this.systems){
            system.init();
        }

        this.keyboard.bind("k", () => {
            this.restartCurrentLevel()
        });
        this.keyboard.bind("g", () => this.paused = !this.paused);
    }

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }

    loadLevel(levelData: CustomMapFormat){
        console.log("Starting scene");
        if(this.levelLoaded) throw new Error("TRYING TO LOAD A LEVEL WHEN ONE IS ALREADY LOADED");
        
        this.currentLevelData = levelData;
        // Set global reference that entities access
        AbstractEntity["ENGINE_OBJECT"] = this;

        // Create terrain and world size
        const worldInfo = levelData.world;
        const width = worldInfo.width;
        const height = worldInfo.height;

        this.levelbbox = new Rect(0,0,width,height);
        
        const bodies = levelData.bodies;
        this.terrain.setupGrid(width, height);
        bodies.forEach( (body) => {
            this.terrain.addTerrain(body.points, body.normals)
        });


        this.collisionManager.setupGrid(width, height);
        
        
        

        this.entityManager.registerSceneSystems(this.systems);

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

        
        this.terrain.graphics = new Graphics();
        this.renderer.addSprite(this.terrain.graphics);
        this.terrain.queueRedraw();

        loadTestLevel.call(this.entityManager);

        this.levelLoaded = true;

        // this.camera["center"].set(this.player.position);
        this.camera.left = 0;
        this.camera.top = 0;
        this.camera.zoom({x:.2,y:.2});
        this.camera.follow(this.entityManager.getEntityByTag("Player").position)
    }

    endCurrentLevel(){
        console.log("Ending level")

        this.entityManager.clear();
        this.terrain.clear();
        this.collisionManager.clear()

        const children = this.renderer.mainContainer.removeChildren();
        const moreChildren = this.renderer.guiContainer.removeChildren();
        // This is crucial --> otherwise there is a memory leak
        children.forEach(child => child.destroy());
        moreChildren.forEach(child => child.destroy());

        this.levelLoaded = false;
    }   

    restartCurrentLevel(){
        this.endCurrentLevel();
        this.loadLevel(this.currentLevelData);
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

        this.networksystem.connect();

        (this.loop.bind(this))();
    }


    getResource(path: string) {
        if(path.startsWith("assets/")) path = path.substr(7);
        
        const fullPath = ASSET_FOLDER_NAME + path;
        const data = SHARED_RESOURCES[fullPath];

        if(data === undefined) throw new Error("Trying to get a resource that we don't have, " + path);
        
        return data;
    }

    private _boundloop = this.loop.bind(this);

    loop(timestamp: number = performance.now()){

        
        if(!this.paused){
            this.accumulated += timestamp - this.lastFrameTimeMs;

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

                this.terrain.update(dt);
                this.collisionManager.update(dt);

                this.mouseEventDispatcher.update(dt)

                this.entityManager.update(dt);


                this.networksystem.writePackets();



                this.tick++;
                this.totalTime += dt;
                this.accumulated -= simulation_time;
            }
            // console.log(performance.now() - timestamp) 
        }
               
        this.renderer.update();

        this.lastFrameTimeMs = timestamp;
        requestAnimationFrame(this._boundloop);
    }

}




