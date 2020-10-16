
import { MouseInput, EngineMouse, InternalMouse } from "../input/mouse";
import * as PIXI from "pixi.js";

import { GUI } from "dat.gui";
import { Renderer } from "./renderer";
import { CameraSystem } from "./camera";
import { Rect } from "../math-library/rectangle";
import { E } from "./globals";
import { LevelHandler } from "./level";

const RESOURCES = PIXI.Loader.shared.resources


let lastFrameTimeMs = 0;
let maxFPS = 59.854; //60
let accumulated = 0;
let simulation_time = 1000 / maxFPS;

// Returns names of files!
// r is the require functio
function importAll(r: any): [] {
    const webpackObjs = r.keys().map(r);
    return webpackObjs.map((v:any) => v.default)
}
const images = importAll(require.context('../../images', true, /\.(json|png|jpe?g|gif)$/));
const ALL_TEXTURES = images.slice(0);
console.log(ALL_TEXTURES)

import { EventEmitter } from "eventemitter3"
import TypedEmitter from "typed-emitter"
import { Entity } from "./entity";
import { CustomMapFormat } from "./tiledmapeditor";
import { Player } from "../gamelogic/player";
import { CreateWindow } from "../apiwrappers/windowopen";
import { Polygon } from "../math-library/polygon";
import { Vec2 } from "../math-library/vec2";
import { drawPoint } from "../math-library/shapedrawing";
import { EngineKeyboard } from "../input/keyboard";
import { Ellipse } from "../math-library/ellipse";
import { EffectHandler } from "./effecthandler";
import { BezierCurve, HermiteCurve } from "../math-library/paths";
import { rgb, blend, Color } from "../math-library/color";
import { ColorTween } from "./tweening/tween";
import { QuadTree } from "../math-library/quadtree";
import { SpatialGrid } from "../math-library/spatialgrid";

export interface CoreEvents  {}

export interface EngineSettings {
    popup: boolean
}

class BearEngine {
    public renderer: Renderer
    public mouse_info = new PIXI.Text("");
    public gui: GUI;
    
    // Total simulated time
    public totalTime = 0;

    // Things that are accessable the API
    private mouse: EngineMouse;
    private keyboard: EngineKeyboard;
    private current_level: LevelHandler = null;
    public effectHandler = new EffectHandler();

    private updateList: Entity[] = [];

    constructor(settings: EngineSettings ){
        E.Engine = this;
        
        this.mouse = new InternalMouse();
        


        if(!settings.popup){
            this.keyboard = new EngineKeyboard(window)
            E.Keyboard = this.keyboard;
            this.mouse.addWindowListeners(window);
            E.Mouse = this.mouse;

            const div = document.querySelector("#display") as HTMLElement;
            this.renderer = new Renderer(div, window);
            const mainCamera = new CameraSystem(this.renderer,this.renderer.mainContainer, window)
        } else { // creates a pop up display
            CreateWindow("Game", {width:400, height:300,center:true}).then(new_window => {
                this.keyboard = new EngineKeyboard(new_window);
                E.Keyboard = this.keyboard;
                this.mouse.addWindowListeners(new_window);
                E.Mouse = this.mouse;
                
                const displayDiv = new_window.document.createElement("div")
                new_window.document.body.appendChild(displayDiv);

                this.renderer = new Renderer(displayDiv, new_window);
                const camera = new CameraSystem(this.renderer,this.renderer.mainContainer, new_window)
            });
        }

        
        this.gui = new GUI();

        let gui_layer = this.renderer.guiContainer;
    
        this.mouse_info.x = 5;
        this.mouse_info.y = this.renderer.getPercentHeight(1) - 50;
        gui_layer.addChild(this.mouse_info)
    }

    async initRenderer(){

    }

	startLevel(level_struct: CustomMapFormat){
		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();
        E.Level = this.current_level;
        E.Terrain = this.current_level.terrainManager;
    
        
        this.addEntity(new Player())

        // Rectangle overlap test
        class Test extends Entity {
            
            private rec1 = new Rect(400,400,100,100);
            private anchorPoint = new Vec2(0,0);

            update(dt: number): void {
                if(E.Mouse.wasPressed("left")){
                    this.anchorPoint.set(E.Mouse.position);
                }
                this.redraw()
            }

            draw(g: PIXI.Graphics): void {
                g.clear();
                g.lineStyle(3, rgb(255,0,0).value());
                this.rec1.draw(g, 0xFF0000);
        
                const rec2 = Rect.fromPoints(this.anchorPoint, E.Mouse.position);
                rec2.draw(g, 0x00FF00)

                const overlap =  this.rec1.intersection(rec2);
                if(overlap) overlap.draw(g,0x0000FF);

            }
        }

        this.addEntity(new Test())

        // Color blend of hermite curve
        class Test2 extends Entity {
                
            private bez = new HermiteCurve([
                new Vec2(0,0), 
                new Vec2(500,0), 
                new Vec2(100,100), 
                new Vec2(200,100), 
                new Vec2(0,300),
                new Vec2(-100,300),
                new Vec2(-300,0),
                new Vec2(-100,200),
            ])

            private percent: number = 0;
            private points = this.bez.bakePoints();

            private color: Color;

            constructor(){
                super();
                this.color = rgb(255,255,255);

                E.Engine.effectHandler.addEffect(
                    new ColorTween(this, "color", 5).from(this.color.clone()).to(rgb(255,5,5)).go()
                ).chain(new ColorTween(this, "color", 2).from((rgb(255,5,5))).to(rgb(1,0,255)))
            }

            update(dt: number): void {
                this.percent += +E.Mouse.isDown("left") * .01;
                this.percent %= 1;
                this.redraw()
            }

            draw(g: PIXI.Graphics): void {
                g.clear();
                this.points.draw(g, this.color.value());
            }
        }

        this.addEntity(new Test2())

        class Test3 extends Entity {

            private tree = new QuadTree<Vec2>(E.Level.bbox.width,E.Level.bbox.height,(vec) => new Rect(vec.x, vec.y, 2, 2));
            private counter: number = 1;

            constructor() {
                super();
            }

            update(dt: number): void {
                if(E.Mouse.wasReleased("left")) this.counter = 1;
                if(E.Mouse.isDown("left")) this.counter++;
                if(this.counter % 4 === 0){
                    this.tree.insert(E.Mouse.position.clone())
                    this.redraw();
                }
            }
            draw(g: PIXI.Graphics): void {
                g.clear();
                this.tree.draw(g);
            }
        }

        this.addEntity(new Test3());
    }


    start(){
        (this.loop.bind(this))()
    }

    // Loads assets from server
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
        }
    }

    addEntity(e: Entity): Entity {
        this.updateList.push(e);
        this.renderer.addSprite(e.graphics);
        return e;
    }
   

    loop(timestamp: number = performance.now()){
        accumulated += timestamp - lastFrameTimeMs;

        /// Setting mouse world position values
        const canvasPoint = new PIXI.Point();
        this.renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.mouse.screenPosition.x,this.mouse.screenPosition.y);
        /// @ts-ignore
        this.renderer.mainContainer.toLocal(canvasPoint,undefined,this.mouse.position);


        this.mouse_info.text = `${ round(this.mouse.position.x, 1)},${round( this.mouse.position.y, 1)}`


        lastFrameTimeMs = timestamp;
        // if we are more than a second behind, probably lost focus on page (rAF doesn't get called if the tab is not in focus)
        if(accumulated > 1000){
            accumulated = 0;
        }

        this.keyboard.update();
        this.mouse.update();
        // both of these are in ms
        while (accumulated >= (simulation_time)) {
            // divide by 1000 to get seconds
            const dt = simulation_time / 1000;

            for (let i = 0; i < this.updateList.length; i++) {
                const entity = this.updateList[i];
                entity.update(dt);
                entity.updateParts(dt);
            }

            this.effectHandler.update(dt);

            this.totalTime += dt;
            accumulated -= simulation_time;
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
        const children = this.renderer.mainContainer.removeChildren();
        // This is extremely crucial --> otherwise there is kinda of a memory leak (PIXI has its own garbage collector but it sets in only after a few minutes)
        children.forEach(child => child.destroy())
        for(let i = this.updateList.length - 1; i >= 0; --i){
            this.destroyEntity(this.updateList[i]);
        }
    }   

}


function round(num: number, val = 0) {
    const rounder = Math.pow(10, val);
    return Math.round(num * rounder) / rounder
}


export {
    BearEngine,
}



