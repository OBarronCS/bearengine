
import { EngineMouse, InternalMouse } from "../input/mouse";
import { GUI } from "dat.gui";
import { RendererSystem } from "./renderer";
import { CameraSystem } from "./camera";
import { EventEmitter } from "eventemitter3"
import TypedEmitter from "typed-emitter"
import { Entity, GMEntity, SpriteEntity } from "./entity";
import { Player } from "../gamelogic/player";
import { CreateWindow } from "../apiwrappers/windowopen";
import { EngineKeyboard } from "../input/keyboard";
import { loadTestLevel } from "../gamelogic/testlevelentities";
import { BufferedNetwork } from "./networking/socket";

import { CustomMapFormat, ParseTiledMapData } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { PartQuery } from "shared/core/partquery";
import { Text, Graphics, Loader, TextStyle, utils, Point, Sprite } from "pixi.js";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { AbstractEntity } from "shared/core/abstractentity";
import { Subsystem } from "shared/core/subsystem";
import { round } from "shared/miscmath";
import { NetworkedEntityManager } from "./networking/gamemessagemanager";
import { RemoteLocations } from "./networking/remotecontrol";


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
    popup: boolean
}

class BearEngine {

    public renderer: RendererSystem;

    public camera: CameraSystem;

    public mouse_info = new Text("",new TextStyle({"fill": "white"}));
    

    // Total simulated time, in seconds
    public totalTime = 0;

    public mouse: EngineMouse = null;
    public keyboard: EngineKeyboard = null;
    public current_level: LevelHandler = null;

    
    private updateList: AbstractEntity[] = [];
    private partQueries: PartQuery<any>[] = [];


    private network: BufferedNetwork;
    private networkMessageHandler = new NetworkedEntityManager(this);
    public remotelocations: PartQuery<RemoteLocations>;
    

    private player: Player;

    constructor(settings: EngineSettings){        
        this.network = new BufferedNetwork("ws://127.0.0.1:8080");
        this.network.connect();
        this.remotelocations = new PartQuery(RemoteLocations);
        this.partQueries.push(this.remotelocations);

        

        this.mouse = new InternalMouse();

        if(!settings.popup){
            this.keyboard = new EngineKeyboard(window)
            this.mouse.addWindowListeners(window);

            const div = document.querySelector("#display") as HTMLElement;
            
            this.renderer = new RendererSystem(div, window);
            this.camera = new CameraSystem(this.renderer,this.renderer.mainContainer, window, this.mouse, this.keyboard);
            
            /////////// Stops right click CONTEXT MENU from showing
            div.addEventListener('contextmenu', function(ev) {
                ev.preventDefault();
                return false;
            }, false);
            ////////////

            this.partQueries.push(this.renderer.graphicsQuery);
            this.partQueries.push(this.renderer.spriteQuery);
            
        } else { // creates a pop up display
            CreateWindow("Game", {width:400, height:300,center:true}).then(new_window => {
                this.keyboard = new EngineKeyboard(new_window);
                this.mouse.addWindowListeners(new_window);
                
                const displayDiv = new_window.document.createElement("div")
                new_window.document.body.appendChild(displayDiv);

                this.renderer = new RendererSystem(displayDiv, new_window);
                this.camera = new CameraSystem(this.renderer,this.renderer.mainContainer, new_window, this.mouse, this.keyboard);
            });
        }

        const gui_layer = this.renderer.guiContainer;
    
        this.mouse_info.x = 5;
        this.mouse_info.y = this.renderer.getPercentHeight(1) - 50;
        gui_layer.addChild(this.mouse_info);
    }

    // Creates the WebGL view using PIXI.js, so the game can be rendered
    // Connects keyboard and mouse listeners
    startRenderer(settings: EngineSettings){
        
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

    start(){
        (this.loop.bind(this))()
    }

    registerSystem<T extends Subsystem>(system: T) {
        this.partQueries.push(...system.queries);
        return system;
    }

	startLevel(level_struct: CustomMapFormat){
        level_struct = ParseTiledMapData(<any>level_struct);
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
        })
        

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
    

        loadTestLevel.call(this);
        this.addEntity(this.player = new Player())
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

        this.mouse_info.text = `${ round(this.mouse.position.x, 1)},${round( this.mouse.position.y, 1)}`


        
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
                entity.postUpdate();
            }

            this.totalTime += dt;
            accumulated -= simulation_time;
        }
        
        // Purely for testing. 
        {
            if(this.network.SERVER_IS_TICKING){
                const stream = new BufferStreamWriter(new ArrayBuffer(1 + 4 + 4));

                stream.setUint8(ServerBoundPacket.PLAYER_POSITION);
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
            })
        }
    }

    addEntity<T extends AbstractEntity>(e: T): T {
        this.updateList.push(e);
        e.onAdd();

        this.partQueries.forEach(q => {
            q.addEntity(e)
        })

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



