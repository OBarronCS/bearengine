
import { EngineMouse, InternalMouse } from "../input/mouse";
import { GUI } from "dat.gui";
import { Renderer } from "./renderer";
import { CameraSystem } from "./camera";
import { E } from "./globals";
import { EventEmitter } from "eventemitter3"
import TypedEmitter from "typed-emitter"
import { Entity, GMEntity, SimpleMovement, SpriteEntity } from "./entity";
import { Player } from "../gamelogic/player";
import { CreateWindow } from "../apiwrappers/windowopen";
import { EngineKeyboard } from "../input/keyboard";
import { loadTestLevel } from "../gamelogic/testlevelentities";
import { BufferedNetwork } from "./networking/socket";

import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { EffectHandler } from "shared/core/effecthandler";
import { PartQuery } from "shared/core/partquery";
import { Text, Graphics, Loader, TextStyle, utils, Point } from "pixi.js";
import { NetworkedEntityManager } from "./networking/gamemessagemanager";
import { NetworkObjectInterpolator } from "./networking/objectinterpolator";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";



const RESOURCES = Loader.shared.resources

let lastFrameTimeMs = 0;
let maxFPS = 60;
let accumulated = 0;
let simulation_time = 1000 / maxFPS;

// Returns names of files!
// r is the require function
function importAll(r: any): [] {
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}
const images = importAll(require.context('../../images', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES = images.slice(0);
console.log(ALL_TEXTURES)


export interface CoreEvents  {}

export interface EngineSettings {
    popup: boolean
}

class BearEngine {

    public renderer: Renderer;

    public camera: CameraSystem;

    public mouse_info = new Text("",new TextStyle({"fill": "white"}));
    

    // Total simulated time, in seconds
    public totalTime = 0;

    // Things that should be globally accessible by E
    private mouse: EngineMouse;
    private keyboard: EngineKeyboard;
    private current_level: LevelHandler = null;

    public effectHandler = new EffectHandler();
    
    private updateList: Entity[] = [];

    private partQueries: PartQuery<any>[] = []

    private network: BufferedNetwork;
    private interpolator: NetworkObjectInterpolator;


    private player: Player;

    constructor(settings: EngineSettings){
        E.Engine = this;
        
        this.network = new BufferedNetwork("ws://127.0.0.1:8080");
        this.network.connect();


        this.interpolator = new NetworkObjectInterpolator(this.network);
        this.partQueries.push(this.interpolator.partQuery)


        this.mouse = new InternalMouse();

        if(!settings.popup){
            this.keyboard = new EngineKeyboard(window)
            E.Keyboard = this.keyboard;

            this.mouse.addWindowListeners(window);
            E.Mouse = this.mouse;

            const div = document.querySelector("#display") as HTMLElement;

            /////////// CONTEXT MENU
            div.addEventListener('contextmenu', function(ev) {
                ev.preventDefault();
                return false;
            }, false);
            ////////////

            this.renderer = new Renderer(div, window);
            const mainCamera = this.camera = new CameraSystem(this.renderer,this.renderer.mainContainer, window);
        } else { // creates a pop up display
            CreateWindow("Game", {width:400, height:300,center:true}).then(new_window => {
                this.keyboard = new EngineKeyboard(new_window);
                E.Keyboard = this.keyboard;
                this.mouse.addWindowListeners(new_window);
                E.Mouse = this.mouse;
                
                const displayDiv = new_window.document.createElement("div")
                new_window.document.body.appendChild(displayDiv);

                this.renderer = new Renderer(displayDiv, new_window);
                const camera = this.camera = new CameraSystem(this.renderer,this.renderer.mainContainer, new_window)
                
            });
        }

        const gui_layer = this.renderer.guiContainer;
    
        this.mouse_info.x = 5;
        this.mouse_info.y = this.renderer.getPercentHeight(1) - 50;
        gui_layer.addChild(this.mouse_info)
    }


	startLevel(level_struct: CustomMapFormat){
		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();

        this.renderer.pixiapp.renderer.backgroundColor = utils.string2hex(level_struct.world.backgroundColor)

        E.Level = this.current_level;
        E.Terrain = this.current_level.terrainManager;
        E.Collision = this.current_level.collisionManager;
        
        const g = new Graphics()
        this.current_level.draw(g)
        this.renderer.addSprite(g);

        this.partQueries.push(this.current_level.collisionManager.partQuery);
    

        loadTestLevel.call(this);
        this.addEntity(this.player = new Player())
    }


    start(){
        (this.loop.bind(this))()
    }

    // Creates the WebGL view using PIXI.js, so the game can be rendered
    async startRenderer(settings: EngineSettings){
        
    }

    // Loads all assets from server
    async preload(): Promise<typeof RESOURCES>{
        return new Promise((resolve) => this.renderer.initTextures(ALL_TEXTURES, () => {
            resolve(RESOURCES)
        }));
    }

    destroyEntity(e: Entity): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            this.updateList.splice(index,1);
            e.parts.forEach(part => part.onRemove());

            this.renderer.removeSprite(e.graphics);

            this.partQueries.forEach(q => {
                q.deleteEntity(e)
            })
        }

 
    }

    addEntity(e: Entity): Entity {
        this.updateList.push(e);
        this.renderer.addSprite(e.graphics);

        this.partQueries.forEach(q => {
            q.addEntity(e)
        })

        return e;
    }
   

    loop(timestamp: number = performance.now()){
        accumulated += timestamp - lastFrameTimeMs;

        /// Setting mouse world position values
        const canvasPoint = new Point();
        this.renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.mouse.screenPosition.x,this.mouse.screenPosition.y);
        /// @ts-expect-error
        this.renderer.mainContainer.toLocal(canvasPoint,undefined,this.mouse.position);

        this.mouse_info.text = `${ round(this.mouse.position.x, 1)},${round( this.mouse.position.y, 1)}`


        lastFrameTimeMs = timestamp;
        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(accumulated > 1000){
            accumulated = 0;
        }

        this.keyboard.update();
        this.mouse.update();


        // Checks buffer
        //const stream = this.network.tick();

        this.interpolator.update();

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
        
        // Purely for testing. 
        {
            if(this.network.SERVER_IS_TICKING){
                const stream = new BufferStreamWriter(new ArrayBuffer(1 + 4 + 4));

                stream.setUint8(ServerBoundPacket.PLAYER_POSITION);
                stream.setFloat32(this.player.x);
                stream.setFloat32(this.player.y);

                this.network.send(stream.getBuffer())
            }
        }

        this.renderer.update((timestamp - lastFrameTimeMs) / 1000);

        requestAnimationFrame(t => this.loop(t))
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

        this.partQueries = [];

        const children = this.renderer.mainContainer.removeChildren();
        // This is crucial --> otherwise there is a memory leak
        children.forEach(child => child.destroy())
    }   

}


function round(num: number, val = 0) {
    const rounder = Math.pow(10, val);
    return Math.round(num * rounder) / rounder
}


export {
    BearEngine,
}



