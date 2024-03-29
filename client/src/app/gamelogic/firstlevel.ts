import { Graphics, Sprite } from "shared/graphics/graphics";
import { ColliderPart } from "shared/core/entitycollision";
import { EntitySystem } from "shared/core/entitysystem";
import { TiledMap } from "shared/core/tiledmapeditor";
import { dimensions } from "shared/shapes/rectangle";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "../core-engine/bearengine";
import { DrawableEntity, Entity, GMEntity } from "../core-engine/entity";
import { GameLevel } from "../core-engine/gamelevel";
import { SpritePart } from "../core-engine/parts";
import { Player } from "./player";
import { Polygon } from "shared/shapes/polygon";
import { Emitter } from "shared/graphics/particles";
import { PARTICLE_CONFIG } from "shared/core/sharedlogic/sharedparticles";
import { TickTimer } from "shared/datastructures/ticktimer";
import { Line } from "shared/shapes/line";
import { drawCircle, drawCircleOutline, drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { ItemDrawer } from "../core-engine/clientitems";
import { BoostZone } from "./boostzone";
import { SimpleBouncePhysics } from "shared/core/sharedlogic/sharedphysics";
import { swap, swap_with_last } from "shared/datastructures/arrayutils";


// export class FirstLevel extends GameLevel {
    
//     path: string | TiledMap = "assets/firsttest.json";

//     // subset = this.game.entities.createSubset();

//     update(dt: number): void {
//     }

//     start(): void {

//     }

//     end(): void {

//     }
// }



export class PhysicsDotEntity extends DrawableEntity {
    
    private sprite: SpritePart;
    
    private slow_factor = 0.7;

    velocity = new Vec2(0,0);
    private gravity = new Vec2(0,.4);

    grounded = false;

    private drawRadius = 10;

    constructor(point: Coordinate, spr_source: string | Sprite){
        super();
        this.position.set(point);
        this.redraw();

        this.sprite = this.addPart(new SpritePart(spr_source));


        this.sprite.originPercent = new Vec2(.5, .5);
    }


    draw(g: Graphics): void {
        //g.beginFill(0x00FF00);
        //g.drawCircle(this.x, this.y, this.drawRadius);
    }

    

    update(dt: number): void {

        if(this.grounded) return;
        const status = SimpleBouncePhysics(this.game.terrain, this.position, this.velocity, this.gravity, this.slow_factor)
        if(status.stopped) this.grounded = true;
        
        this.redraw(true);
    }
}




export class PurePolygonCarveTest extends DrawableEntity {
        
    private point: Vec2;
    private polygons = [Polygon.random(5, 170)];
    
    private r = 50;

    constructor(){
        super();
    }

    update(dt: number): void {
        this.point = this.mouse.position.clone()// this.poly.polygon.closestPoint(this.Mouse.position);
        //console.log(this.point)
        // if(this.mouse.wasPressed("left")) { 
        //     this.terrain.carvePolygon(this.polygon, this.point);
        // }

        if(this.mouse.wasPressed("left")){
            for(let i = 0; i < this.polygons.length; i++){
                const p = this.polygons[i];

                const r = p.carve_circle(this.point.x, this.point.y, 50)
                if(r.type === "normal") {
                    console.log("carved")
                    swap_with_last(this.polygons, i);
                    this.polygons.pop();
                    this.polygons.push(...r.parts);
                } else if(r.type === "missed"){
                    console.log("missed");
                } else if(r.type == "total"){
                    console.log("total");
                    swap_with_last(this.polygons, i);
                    this.polygons.pop();
                }
            }

        }

        if(this.keyboard.wasReleased("KeyY")) this.polygons = [Polygon.random(5, 170)];
        
        this.redraw(true);
    }

    draw(g: Graphics): void {
        //// @ts-expect-error
        //g.position = this.point// (this.point.x, this.point.y);
        this.polygons.forEach(p => p.draw(g, 0x0000FF));

        drawPoint(g,this.point,0xFF0000);
        drawCircleOutline(g, this.point, 50);
    }
}




// const scene = this.game.entities;

// class CircleLineIntersectionTest extends DrawableEntity {
        
//     private circle = new Vec2(0,0);
    
//     private point = new Vec2(0,0);

//     draw(g: Graphics): void {
//         drawCircle(g, this.circle, 50)

//         if(this.mouse.wasPressed("right")) { 
//             this.circle.x = this.mouse.x;
//             this.circle.y = this.mouse.y;
//         }
//         if(this.mouse.wasPressed("left")) this.point = this.mouse.position.clone();

//         const otherPoint = this.mouse.position.clone();

//         drawLineBetweenPoints(g,this.point,otherPoint);

//         const points = Line.CircleLineIntersection(this.point, otherPoint, this.circle.x, this.circle.y, 50);
        
//         for(const point of points.points){
//             drawPoint(g,point);
//         }
//     }
//     update(dt: number): void {
//         this.redraw()
//     }

// }

// scene.addEntity(new CircleLineIntersectionTest);

// this.emitter = this.engine.renderer.addEmitter("assets/particle.png", PARTICLE_CONFIG["BOOM"], 0,0);

// scene.addEntity(new PolygonExpandTest)


// class TestEntityForVideo extends Entity {

//     private sprite = this.addPart(new SpritePart("tree.gif"));
//     private collider = this.addPart(new ColliderPart(dimensions(200,200), Vec2.ZERO));


//     update(dt: number): void {}

//     // @bearevent("mousehover", {})
//     daisvfdakusvdjasd(point: Vec2){
//         console.log("Hello, i was hovered", point.toString());
//     }

//     //@bearevent("tap", {})
//     ontapcallback(num: Vec2){
//         console.log("I was clicked")
//     }

//     @bearevent("mousedown", { button: "left"})
//     asdasdasdasd(point: Vec2){
//         console.log("HEOLLO")
//     }

//     @bearevent("scroll", {})
//     asdasd(scroll: number, point: Vec2){
//         console.log(scroll)
//     }
// }

// const test = new TestEntityForVideo();            
// engine.entityManager.addEntity(test);

// class SuperTest extends GMEntity {

//     constructor(){
//         super({x: 100, y: 100}, "flower.png", dimensions(100,100));
//     }
//     update(dt: number): void {
       
//     }

//     @bearevent("scroll", { button: "left"} )
//     test(scroll: number, mousePoint: Vec2){
//         console.log(mousePoint.x)
//     }
// }

//scene.addEntity(new SuperTest());

// class OtherTest extends GMEntity {
//     constructor(){
//         super({x: 400, y: 400}, "bullet.png", dimensions(20,20));
//     }
//     update(dt: number): void {
       
//     }
// }

//scene.addEntity(new OtherTest());




