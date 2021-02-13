
import { InternalMouse, EngineMouse } from "../input/mouse";
import { GUI } from "dat.gui";
import { RendererSystem } from "./renderer";
import { CameraSystem } from "./camera";
import { EventEmitter } from "eventemitter3";
import TypedEmitter from "typed-emitter";
import { Entity, GMEntity, SpriteEntity } from "./entity";
import { Player } from "../gamelogic/player";
import { CreateWindow } from "../apiwrappers/windowopen";
import { EngineKeyboard } from "../input/keyboard";
import { loadTestLevel } from "../gamelogic/testlevelentities";
import { BufferedNetwork } from "./networking/socket";

import { CustomMapFormat, ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { PartQuery } from "shared/core/partquery";
import { Text, Graphics, Loader, TextStyle, utils, Point, Sprite } from "pixi.js";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ClientPacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { AbstractEntity } from "shared/core/abstractentity";
import { Subsystem } from "shared/core/subsystem";
import { round } from "shared/miscmath";
import { NetworkedEntityManager } from "./networking/gamemessagemanager";
import { RemoteLocations } from "./networking/remotecontrol";
import { Vec2 } from "shared/shapes/vec2";


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

export interface EngineSettings {
    popup: false
}

class BearEngine {

    public renderer: RendererSystem = null;

    public camera: CameraSystem = null;

    private mouse_info: Text = null;
    

    // Total simulated time, in seconds
    public totalTime = 0;

    public mouse: InternalMouse = null;
    public keyboard: EngineKeyboard = null;
    public current_level: LevelHandler = null;

    
    private updateList: AbstractEntity[] = [];
    private partQueries: PartQuery<any>[] = [];


    private network: BufferedNetwork = null;
    private networkMessageHandler = new NetworkedEntityManager(this);
    public remotelocations: PartQuery<RemoteLocations> = new PartQuery(RemoteLocations);
    

    private player: Player = null;

    constructor(){        
        this.network = new BufferedNetwork("ws://127.0.0.1:8080");
    }

    private async initRenderer(settings: EngineSettings): Promise<RendererSystem> {
        if(!settings.popup){
            
            const div = document.querySelector("#display") as HTMLElement;
            
            return new RendererSystem(div, window);

        } else { // creates a pop up display
            throw new Error("Not implemented")
            // In reality, I need to load the entire codebase in the seperate window for it to work properly
            // const new_window = await CreateWindow("Game", {width:400,height:300,center:true});
            // console.log(new_window)
            // const displayDiv = new_window.document.createElement("div");
            // new_window.document.body.appendChild(displayDiv);
                
            // return new RendererSystem(displayDiv, new_window);
        }
    }

    // Creates the WebGL view using PIXI.js, so the game can be rendered
    // Connects keyboard and mouse listeners
    async startRenderer(settings: EngineSettings): Promise<void> {
        this.renderer = await this.initRenderer(settings);

        const targetWindow = this.renderer.targetWindow;
        const targetDiv = this.renderer.targetDiv;

        this.mouse = new EngineMouse();
        this.mouse.addWindowListeners(targetWindow);

        this.keyboard = new EngineKeyboard(targetWindow)

        this.camera = new CameraSystem(this.renderer,this.renderer.mainContainer, targetWindow, this.mouse, this.keyboard);
        

        this.mouse_info = new Text("",new TextStyle({"fill": "white"}));
        this.mouse_info.x = 5;
        this.mouse_info.y = this.renderer.getPercentHeight(1) - 50;
        this.renderer.addGUI(this.mouse_info);

                                
        targetDiv.addEventListener('contextmenu', function(ev) {
            ev.preventDefault();
            return false;
        }, false);
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

    registerSystem<T extends Subsystem>(system: T) {
        this.partQueries.push(...system.queries);
        return system;
    }

    // it doesn't actually take this in as CustomMapFormat. It turns a Tiled struct into it
	startLevel(levelData: CustomMapFormat){
        const level_struct = levelData;

		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();

        this.renderer.renderer.backgroundColor = utils.string2hex(level_struct.world.backgroundcolor);

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
            Level:this.current_level,
            Collision:this.current_level.collisionManager,
            Scene:this,
            Terrain:this.current_level.terrainManager,
        }

        Entity.BEAR_ENGINE = this;
        
        const g = new Graphics();
        this.current_level.draw(g);
        this.renderer.addSprite(g);

        this.partQueries.push(this.current_level.collisionManager.partQuery);
        this.partQueries.push(this.renderer.graphicsQuery);
        this.partQueries.push(this.renderer.spriteQuery);
        this.partQueries.push(this.remotelocations);

        loadTestLevel.call(this);
        this.addEntity(this.player = new Player())
        this.camera["center"].set(this.player.position);
        this.camera.zoom(Vec2.HALFHALF)
        // this.camera.follow(this.player.position)
    }


    updateNetwork(){
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
        // Setting mouse world position, requires the renderer to map the point

        const canvasPoint = new Point();
        this.renderer.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.mouse.screenPosition.x,this.mouse.screenPosition.y);
        /// @ts-expect-error
        this.renderer.mainContainer.toLocal(canvasPoint,undefined,this.mouse.position);

        this.mouse_info.text = `${ round(this.mouse.position.x, 1)},${round( this.mouse.position.y, 1)}`;

        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(accumulated > 1000){
            accumulated = 0;
        }

        this.keyboard.update();
        this.mouse.update();

        this.updateNetwork();


        // both of these are in ms
        while (accumulated >= (simulation_time)) {

            // divide by 1000 to get seconds
            const dt = simulation_time / 1000;

            this.current_level.collisionManager.update(dt);

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
            if(this.network.SERVER_IS_TICKING){
                const stream = new BufferStreamWriter(new ArrayBuffer(1 + 1 + 4 + 4));

                stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);
                stream.setUint8(ClientPacket.PLAYER_POSITION)
                stream.setFloat32(this.player.x);
                stream.setFloat32(this.player.y);

                this.network.send(stream.getBuffer());
            }
        }

        //simulation time
        // console.log(performance.now() - timestamp)
        this.camera.update();
        this.renderer.render();
        

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
        const data = this.current_level.data_struct;
        this.endCurrentLevel();
        this.startLevel(data);
    }

    endCurrentLevel(){
        this.current_level.end();

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



