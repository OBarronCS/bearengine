
import { EngineMouse } from "../input/mouse";
import { GUI } from "dat.gui";
import { RendererSystem } from "./renderer";
import { CameraSystem } from "./camera";
import { EventEmitter } from "eventemitter3";
import TypedEmitter from "typed-emitter";
import { Entity, GMEntity, SpriteEntity } from "./entity";
import { Player } from "../gamelogic/player";
import { EngineKeyboard } from "../input/keyboard";
import { loadTestLevel } from "../gamelogic/testlevelentities";
import { BufferedNetwork } from "./networking/socket";

import { CustomMapFormat, ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { PartQuery } from "shared/core/partquery";
import { Graphics, Loader, utils, Sprite } from "pixi.js";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ClientPacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { AbstractEntity } from "shared/core/abstractentity";
import { Subsystem } from "shared/core/subsystem";
import { NetworkedEntityManager } from "./networking/gamemessagemanager";
import { RemoteLocations } from "./networking/remotecontrol";
import { Vec2 } from "shared/shapes/vec2";
import { AbstractBearEngine } from "shared/core/abstractengine";


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


export interface CoreEvents  {}


class BearEngine implements AbstractBearEngine {

    // IMPORTANT SYSTEMS
    public renderer: RendererSystem = null;
    public camera: CameraSystem = null;
    public mouse: EngineMouse = null;
    public keyboard: EngineKeyboard = null;
    public level: LevelHandler = null;

    
    private systems: Subsystem[] = [];
    private updateList: AbstractEntity[] = [];
    private partQueries: PartQuery<any>[] = [];


    private network: BufferedNetwork = null;
    private networkMessageHandler = new NetworkedEntityManager(this);
    public remotelocations: PartQuery<RemoteLocations> = new PartQuery(RemoteLocations);
    

    public levelGraphic = new Graphics();

    private player: Player = null;


    // Total simulated time, in seconds
    public totalTime = 0;


    constructor(){        
        this.network = new BufferedNetwork("ws://127.0.0.1:8080");
    }

    // DOES NOT start ticking yet
    init(): void {
        const div = document.querySelector("#display") as HTMLElement;
            
        this.renderer = this.registerSystem(new RendererSystem(this, div, window));
        this.mouse = this.registerSystem(new EngineMouse(this));
        this.keyboard = this.registerSystem(new EngineKeyboard(this));
        this.camera = this.registerSystem(new CameraSystem(this));
        this.level = this.registerSystem(new LevelHandler(this));


        for(const system of this.systems){
            system.init();
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
        this.renderer.renderer.backgroundColor = utils.string2hex(level_struct.world.backgroundcolor);
         
        for(const system of this.systems){
            this.partQueries.push(...system.queries);
        }

        // TODO: Make networking it's own system
        // TODO: Make entity handling it's own system as well, so I can insert it into the system list
        // But still use the engine as an api to add and delete entities
        this.partQueries.push(this.remotelocations);
       
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
            Scene:this,
            Level:this.level,
            Collision:this.level.collisionManager,
            Terrain:this.level.terrainManager,
        }

        Entity.BEAR_ENGINE = this;
        
        this.levelGraphic = new Graphics();
        this.redrawLevel();
        this.renderer.addSprite(this.levelGraphic);

        
        loadTestLevel.call(this);


        this.addEntity(this.player = new Player())
        this.camera["center"].set(this.player.position);
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
        
        this.network.connect();

        (this.loop.bind(this))();
    }


    readFromNetwork(){
        const packets = this.network.newPacketQueue();

        while(!packets.isEmpty()){
            const packet = packets.dequeue();
            this.networkMessageHandler.readData(packet.id, packet.buffer);
        }

        // Interpolation of entities
        const frameToSimulate = this.network.tickToSimulate();

        for(const obj of this.remotelocations){
            obj.setPosition(frameToSimulate)
        }
    }

    loop(timestamp: number = performance.now()){
        accumulated += timestamp - lastFrameTimeMs;
        lastFrameTimeMs = timestamp;

        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(accumulated > 1000){
            accumulated = 0;
        }

        this.readFromNetwork();

        // both of these are in ms
        while (accumulated >= (simulation_time)) {

            // divide by 1000 to get seconds
            const dt = simulation_time / 1000;

            for(const system of this.systems){
                system.update(dt);
            }

            for (let i = 0; i < this.updateList.length; i++) {
                const entity = this.updateList[i];
                entity.update(dt);
                entity.postUpdate(); // Maybe get rid of this, swap it with systems that I call after step
            }


            this.totalTime += dt;
            accumulated -= simulation_time;
        }
        
        // Purely for testing. 
        {
            if(this.network.CONNECTED && this.network.SERVER_IS_TICKING){
                const stream = new BufferStreamWriter(new ArrayBuffer(1 + 1 + 4 + 4));

                stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);
                stream.setUint8(ClientPacket.PLAYER_POSITION);
                stream.setFloat32(this.player.x);
                stream.setFloat32(this.player.y);

                this.network.send(stream.getBuffer());
            }
        }

        //simulation time
        // console.log(performance.now() - timestamp)
        // No point in rendering everything twice, it's already a system 
        // this.renderer.update();
        

        requestAnimationFrame(t => this.loop(t))
    }

    destroyEntity<T extends AbstractEntity>(e: T): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            e.onDestroy();
            this.updateList.splice(index,1);

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            });
        }
    }

    addEntity<T extends AbstractEntity>(e: T): T {
        this.updateList.push(e);
        e.onAdd();

        this.partQueries.forEach(q => {
            q.addEntity(e)
        });

        return e;
    }

    restartCurrentLevel(){
        const data = this.level.data_struct;
        this.endCurrentLevel();
        this.startLevel(data);
    }

    endCurrentLevel(){
        console.log("Ending level")
        this.level.end();

        this.updateList.forEach( e => {
            e.onDestroy();

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            })
        })

        this.updateList = [];

        this.partQueries = [];

        const children = this.renderer.mainContainer.removeChildren();
        // This is crucial --> otherwise there is a memory leak
        children.forEach(child => child.destroy())
    }   

}





export {
    BearEngine,
}



