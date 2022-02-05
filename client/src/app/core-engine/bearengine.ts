
import { Graphics, Loader, LoaderResource, Sprite, Texture } from "shared/graphics/graphics";
import { GUI, GUIController } from "dat.gui";

import { BearGame, BearScene } from "shared/core/abstractengine";
import { AbstractEntity } from "shared/core/abstractentity";
import { EntitySystem } from "shared/core/entitysystem";
import { Subsystem } from "shared/core/subsystem";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";

import { frameEditor } from "../gamelogic/testlevelentities";
import { EngineKeyboard } from "../input/keyboard";
import { EngineMouse } from "../input/mouse";
import { CameraSystem } from "./camera";
import { NetworkSystem } from "./networking/networksystem";
import { DefaultEntityRenderer, RendererSystem } from "./renderer";
import { TestMouseDownEventDispatcher } from "./mouseevents";
import { Player, player_controls_map } from "../gamelogic/player";
import { DummyLevel, GameLevel } from "./gamelevel";
import { DebugScreen } from "../gamelogic/debugoverlay";
import { Chatbox } from "../gamelogic/chatbox";
import { ButtonWidget, LabelWidget, PanelWidget, SpriteWidget, UIManager, uisize, WidgetAlphaTween, WidgetGroup } from "../ui/widget";
import { Color } from "shared/datastructures/color";
import { mix, Vec2 } from "shared/shapes/vec2";
import { LevelRef } from "shared/core/sharedlogic/assetlinker";
import { DrawableEntity, Entity } from "./entity";
import { PhysicsDotEntity } from "../gamelogic/firstlevel";
import { DefaultInputController } from "../input/inputcontroller";



const SHARED_RESOURCES = Loader.shared.resources;
const SHARED_LOADER = Loader.shared;

export const ASSET_FOLDER_NAME = "assets/";

// Returns names of files!
// r is the require function
function importAll(r: any): [] {
    // console.log(r.keys());
    // console.log(r.resolve(r.keys()[0]));
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}

// This cannot take variable for path, webpack needs string literal for it to work ...
const images = importAll(require.context('../../assets', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES: string[] = images.slice(0);

// console.log("Assets: " + ALL_TEXTURES)

const maxFPS = 60;
const simulation_time = 1000 / maxFPS;

export class BearEngine {

    game: BearGame<this>;

    public tick = 0;
    public totalTime = 0;
    private lastFrameTimeMs = 0;
    private accumulated = 0;

    public paused = false;


    public renderer: RendererSystem;
    public camera: CameraSystem;
    public mouse: EngineMouse;
    public keyboard: EngineKeyboard;



    init(): void {
        const div = document.querySelector("#display") as HTMLElement;
        

        this.mouse = new EngineMouse(this);
        this.keyboard = new EngineKeyboard();

        this.camera = new CameraSystem(this);
        
        this.renderer = new RendererSystem(this, div, window);



        this.mouse.init();
        this.keyboard.init(this.renderer.renderer.view.ownerDocument.defaultView);
        this.camera.init();


        // this.keyboard.bind("k", () => {
        //     this.restartCurrentLevel()
        // });
        // this.keyboard.bind("g", () => this.paused = !this.paused);
    }

    // Loads all assets from server
    async loadAssets(): Promise<typeof SHARED_RESOURCES> {
        return new Promise( (resolve) => {

            SHARED_LOADER.add(ALL_TEXTURES);
    
            SHARED_LOADER.load(() => {
                // console.log("ALL ASSETS DOWNLOADED");
                // console.log('PIXI.Loader.shared.resources :>> ', SHARED_RESOURCES);
                resolve(SHARED_RESOURCES);
            });
        });
    }

    getResource(path: string): LoaderResource | undefined {
        if(path.startsWith(ASSET_FOLDER_NAME)) path = path.substring(ASSET_FOLDER_NAME.length);

        const fullPath = ASSET_FOLDER_NAME + path;
        const data = SHARED_RESOURCES[fullPath];

        // 
        // if(data === undefined) throw new Error("Trying to get a resource that we don't have, " + path);
        if(data === undefined){
            console.error(`Cannot find resource by the name: ${path}`)
        }
        
        return data;
    }

    /** Starts main loop. */
    start(game: BearGame<any>){
        this.game = game;
        this.game.initialize();
        (this.loop.bind(this))();
    }


    private update(dt: number){
        this.mouse.update();
        this.keyboard.update();
        this.camera.update(dt);


        this.game.update(dt);


        this.renderer.updateParticles(dt);
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

                this.update(dt);

                this.tick++;
                this.totalTime += dt;
                this.accumulated -= simulation_time;
            }
        }
               
        this.renderer.update();

        this.lastFrameTimeMs = timestamp;
        requestAnimationFrame(this._boundloop);
    }

}

/*

window.onkeydown = (e: KeyboardEvent) => {
    if(e.code === "KeyO")
        CreateWindow({ width: 400,height:380, center:true}).then(e => {
            console.log("WINDOW LOADED YAY")
        })
}

*/

export class NetworkPlatformGame extends BearGame<BearEngine> {


    public activeLevel: GameLevel;
    public levelLoaded = false;

    public player: Player = null;
    
    // Subsystems
    public networksystem: NetworkSystem;
    public terrain: TerrainManager;
    public collisionManager: CollisionManager;

    private mouseEventDispatcher: TestMouseDownEventDispatcher;

    public entityRenderer: DefaultEntityRenderer;

    public debug: DebugScreen;
    public chatbox: Chatbox

    public ui: UIManager;

    // Scenes
    public mainmenu_scene: MainMenuScene;
    public level_scene: LevelScene;

    //
    temp_level_subset = this.entities.createSubset();

    public player_controller = new DefaultInputController(this.engine.keyboard, this.engine.mouse, player_controls_map);



    initSystems(): void {
        this.networksystem = this.registerSystem(new NetworkSystem(this, {port:80}));
        this.terrain = this.registerSystem(new TerrainManager(this));
        this.collisionManager = this.registerSystem(new CollisionManager(this));
        this.mouseEventDispatcher = this.registerSystem(new TestMouseDownEventDispatcher(this));
        this.entityRenderer = this.registerSystem(new DefaultEntityRenderer(this));
        this.chatbox = this.registerSystem(new Chatbox(this));
        this.ui = this.registerSystem(new UIManager(this));
        this.debug = this.registerSystem(new DebugScreen(this));

        this.mainmenu_scene = this.addScene(new MainMenuScene(this));
        this.level_scene = this.addScene(new LevelScene(this));
    }

    onStart(): void {
        this.enable_scene(this.mainmenu_scene);
    }


    update(dt: number): void {

        this.networksystem.readPackets();

        this.terrain.update(dt);
        this.collisionManager.update(dt);

        this.mouseEventDispatcher.update(dt)

        this.updateScenes(dt);

        if(this.levelLoaded){
            this.activeLevel.update(dt);
        }

        if(this.player !== null){
            this.player.manualUpdate(dt);
        }

        this.entities.update(dt);

        this.chatbox.update(dt);

        this.networksystem.writePackets();

        this.debug.update(dt);

        this.ui.update(dt)

        this.entityRenderer.update(dt);
    }

    onEnd(): void {

    }
    

    loadLevel(level: GameLevel){
        // console.log("Starting level");
        if(this.levelLoaded) throw new Error("TRYING TO LOAD A LEVEL WHEN ONE IS ALREADY LOADED");

        this.activeLevel = level;
        level.internalStart();

        this.levelLoaded = true;
    }

    endCurrentLevel(){
        // console.log("Ending level")

        this.activeLevel.internalEnd();


    
        this.terrain.clear();
        this.collisionManager.clear()

        // this.entities.clear();
        // this.entityRenderer.clear();

        this.levelLoaded = false;
    }   

    restartCurrentLevel(){
        this.endCurrentLevel();
        this.loadLevel(this.activeLevel);
    }
}




export class MainMenuScene extends BearScene<NetworkPlatformGame> {
    group = new WidgetGroup(new Vec2());

    init(): void {


        const b = this.group.addChild((() => { 
            
            const b = new ButtonWidget(new Vec2(), 200,100, () => {

                //console.log(this.game.ui["parent_widget"].children)

                this.game.loadLevel(new DummyLevel(this.game, LevelRef.LOBBY));
                
                
                this.game.disable_scene(this);
                this.game.enable_scene(this.game.level_scene);

                this.game.networksystem.connect();
            });


            b.background_color.copyFrom(Color.from(0xdeadbeef));
            b.draw_color.copyFrom(b.background_color);
            b.setPosition({type: "percent", percent: .50}, {type: "percent", percent: .50});
            b.center();
            return b;
        })());

    
        {
            const label = new LabelWidget(new Vec2(), "Play");
            label.setFontColor(Color.from(0x000000));
            label.setPosition({type: "percent", percent: .50}, {type: "percent", percent: .50});
            label.center();
            
            this.group.addChild(label);
        }

        {
            const label = new LabelWidget(new Vec2(), "Networked Platform Game");
            label.setFontColor(Color.from(0x000000));
            label.setPosition({type: "percent", percent: .50}, {type: "percent", percent: .20});
            label.center();
            
            this.group.addChild(label);
        }

    }

    update(dt: number): void {}

    
    on_enable(): void {
        const bgColor = Color.from(0xd9f9ff);
        bgColor.a = 1;

        this.game.ui.setBackgroundColor(bgColor);
        this.game.ui.addWidget(this.group);

        // this.game.ui.addWidget((() =>  { 
        //     const b = new ButtonWidget(new Vec2(300,50), 100,50, () => console.log("123"));
        //     b.background_color.copyFrom(Color.fromNumber(0xdeadbeef)) 
        //     b.draw_color.copyFrom(b.background_color)
        //     return b;
        // })());
        // const spr = this.game.ui.addWidget(new SpriteWidget(new Vec2(400,60), this.game.engine.renderer.getTexture("flower.png")))



    }

    on_disable(): void {
        this.game.ui.removeWidget(this.group);
        this.game.ui.clearBackground();
    }

}


export class LevelScene extends BearScene<NetworkPlatformGame> {
    
    quit_to_main_menu(){
        this.game.entities.clear();
        this.game.player = null;

        this.game.networksystem.quit_server();

        this.game.endCurrentLevel();


        this.game.disable_scene(this);
        this.game.enable_scene(this.game.mainmenu_scene);
        
    }
    
    init(): void {

    }

    escape_widget = new PanelWidget(new Vec2(),0,0).setSize(uisize.percent(1), uisize.percent(1)).setBackgroundColor(new Color([0,0,0,.25]));
    exit_button = this.escape_widget.addChild(new ButtonWidget(new Vec2(20,20), 200, 98, ()=>{

        this.quit_to_main_menu()

    }).setHoverColor(Color.from(0x676e73)));
    exit_text = this.exit_button.addChild(new LabelWidget(new Vec2(),"Exit").setPosition(uisize.percent(.5), uisize.percent(.5)).center().setFontColor(Color.WHITE));

    update(dt: number): void {
        if(this.game.engine.keyboard.wasPressed("Escape")){
            if(this.escape_widget.parent === null){    
                this.game.ui.addWidget(this.escape_widget);
                this.game.player_controller.disable();
            } else {
                this.game.ui.removeWidget(this.escape_widget);
                this.game.player_controller.enable();
            }
        }

        // if(this.game.engine.keyboard.wasPressed("KeyH")){
        //     this.game.player = this.game.entities.addEntity(new Player())
        // }
    }

    subset = this.game.entities.createSubset();

    on_enable(): void {
        // this.subset.addEntity(new PhysicsEntityTest())
    }

    on_disable(): void {
        this.subset.clear();
        this.game.ui.removeWidget(this.escape_widget);
        this.game.player_controller.enable();
    }


}



class PhysicsEntityTest extends Entity {
    update(dt: number): void {
        if(this.engine.mouse.isDown("left")){
            const e = new PhysicsDotEntity(this.engine.mouse, "blank_string_sprite.png");
            e.velocity.set(this.engine.mouse.velocity.clone().extend(20))
            this.game.entities.addEntity(e)
        }

    }
}
