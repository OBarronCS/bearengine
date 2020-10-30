
import { MouseInput, EngineMouse, InternalMouse } from "../input/mouse";
import * as PIXI from "pixi.js";

import { GUI } from "dat.gui";
import { Renderer } from "./renderer";
import { CameraSystem } from "./camera";
import { dimensions, Rect } from "../math-library/shapes/rectangle";
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
import { Entity, GMEntity, SimpleMovement, SpriteEntity } from "./entity";
import { CustomMapFormat } from "./tiledmapeditor";
import { Player } from "../gamelogic/player";
import { CreateWindow } from "../apiwrappers/windowopen";
import { Polygon } from "../math-library/shapes/polygon";
import { Coordinate, Vec2 } from "../math-library/shapes/vec2";
import { drawCircle, drawPoint, drawVecAsArrow } from "../math-library/shapes/shapedrawing";
import { EngineKeyboard } from "../input/keyboard";
import { Ellipse } from "../math-library/shapes/ellipse";
import { EffectHandler } from "./effecthandler";
import { BezierCurve, HermiteCurve } from "../math-library/paths";
import { rgb, blend, Color } from "../math-library/color";
import { ColorTween } from "./tweening/tween";
import { QuadTree } from "../math-library/quadtree";
import { SpatialGrid } from "../math-library/spatialgrid";
import { LiveGridGraph } from "../math-library/graphs";
import { floor } from "../math-library/miscmath";
import { log } from "../math-library/performance";
import { ColliderPart } from "./parts";
import { Line } from "../math-library/shapes/line";

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
            const mainCamera = new CameraSystem(this.renderer,this.renderer.mainContainer, window);
            mainCamera.container.pivot.y = 380;
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
        E.Collision = this.current_level.collisionManager;
        
    
        
        this.addEntity(new Player())


        class TestCollision extends Entity {
            
            private line: Line;
            private r: Rect;

            constructor(){
                super();
                this.addPart(new ColliderPart(dimensions(50,50), new Vec2(20,20)))
                this.r = new Rect(100,150,50,50);
                this.line = new Line(new Vec2(0,0), new Vec2(0,0));
            }
            
            update(dt: number): void {
                this.line.B.set(E.Mouse.position);
                if(E.Mouse.wasPressed("left")){
                    this.line.A.set(E.Mouse.position);
                }
                this.redraw();
            }
            
            draw(g: PIXI.Graphics): void {
                g.clear();
                this.r.draw(g)
                this.line.draw(g,Rect.CollidesWithLine(this.r, this.line.A.x, this.line.A.y, this.line.B.x, this.line.B.y) ? "#FF0000":"#0000FF" );
            }
        }

        //this.addEntity(new TestCollision())

        class Debug extends Entity {
            update(dt: number): void {
                this.redraw();
            }
            draw(g: PIXI.Graphics): void {
                g.clear();
                E.Collision.draw(g);
            }

        }

        this.addEntity(new Debug())

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

        //this.addEntity(new Test())

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

        //this.addEntity(new Test2())

        class Test3 extends Entity {

            private grid = new LiveGridGraph(25,25);

            constructor() {
                super();
                this.grid.start_astar(0,0,24,24);
                for(let i = 5; i < 20; i++){
                    this.grid.blockcell(i,5);
                }

                for(let i = 5; i < 20; i++){
                    this.grid.blockcell(i,20);
                }

                this.grid.step_astar();
                this.redraw();
            }

            update(dt: number): void {
                if(E.Mouse.isDown("left")){
                    this.grid.blockcell(floor(E.Mouse.position.x / 30),floor(E.Mouse.position.y / 30));
                    this.grid.start_astar(0,0,24,24);
                    console.time();
                    while(!this.grid.step_astar()){}
                    console.timeEnd();
                    
                    this.redraw();
                }
            }

            draw(g: PIXI.Graphics): void {
                g.clear();
                g.moveTo(0,0);
                //this.grid.draw(g,30);
                

                drawVecAsArrow(g,Vec2.RIGHT,-50,0,50);
                drawVecAsArrow(g,Vec2.NE,-25,25,50);
                const r = Vec2.bounce(Vec2.RIGHT, Vec2.NW)
                drawVecAsArrow(g,r,0,0,50);
                log(r.length())
            }
        }

        //this.addEntity(new Test3());

        class FirstSprite extends GMEntity {
            
            constructor(spot: Coordinate){
                super(spot,"images/tree.gif");
            }

            update(dt: number): void {
                // SimpleMovement(this,250 * dt);
                this.moveTowards(E.Mouse.position,21);
            }

            draw(g: PIXI.Graphics): void {
                
            }

        }

        //this.addEntity(new FirstSprite({x:50,y:170}));

        class PolygonTest extends Entity {

                public p = Polygon.from([new Vec2(0,170),  new Vec2(150,0), new Vec2(0,0)]);

            constructor(){super(); this.redraw();}

            update(dt: number): void {
            
            }
            draw(g: PIXI.Graphics): void {
                this.p.draw(g);
            }

        }

        this.addEntity(new PolygonTest());
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



