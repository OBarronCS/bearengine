import { Graphics } from "pixi.js";
import { ColliderPart } from "shared/core/entityattribute";
import { bearevent } from "shared/core/bearevents";
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
import { Emitter } from "pixi-particles";
import { PARTICLE_CONFIG } from "../core-engine/particles";
import { TickTimer } from "shared/datastructures/ticktimer";
import { Line } from "shared/shapes/line";
import { drawVecAsArrow } from "shared/shapes/shapedrawing";



// class PolygonExpandTest extends DrawableEntity {

//     poly = Polygon.random(24);
//     expandedpoly = this.poly;
//     test = this.redraw()




//     draw(g: Graphics): void {
//         this.poly.draw(g);
//         this.expandedpoly.draw(g);
//     }

//     update(dt: number): void {
//         if(this.keyboard.wasPressed("KeyL")){
//             this.expandedpoly = this.expandedpoly.expand(50);
//             this.redraw()
//         }
//     }
// }

export class FirstLevel extends GameLevel {
    
    path: string | TiledMap = "assets/firsttest.json";


    private emitter: Emitter;

    update(dt: number): void {
        this.emitter.updateSpawnPos(this.engine.mouse.x, this.engine.mouse.y);
        if(this.engine.mouse.wasPressed("left")){

            const e = new PhysicsDotEntity(this.engine.mouse);
            e.velocity.set(this.engine.mouse.velocity.clone().scale(.2))
            e.velocity.set({x:30,y:0})

            this.game.entities.addEntity(e)
        }
    }

    start(): void {
        this.emitter = this.engine.renderer.addEmitter("assets/particle.png", PARTICLE_CONFIG["ROCKET"], this.engine.mouse.x, this.engine.mouse.y);

        
        // scene.addEntity(new PolygonExpandTest)
        //const p = scene.addEntity(new Player());

        class Test7 extends Entity {

            private a = this.addPart(new ColliderPart(dimensions(10,10), Vec2.ZERO));
            // private dd = this.addPart(new ColliderPart(dimensions(10,10), Vec2.ZERO));

            update(dt: number): void {

            }

        }

        //scene.addEntity(new Test7())

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

        class SuperTest extends GMEntity {

            constructor(){
                super({x: 100, y: 100}, "flower.png", dimensions(100,100));
            }
            update(dt: number): void {
               
            }

            @bearevent("scroll", { button: "left"} )
            test(scroll: number, mousePoint: Vec2){
                console.log(mousePoint.x)
            }
        }

        //scene.addEntity(new SuperTest());

        class OtherTest extends GMEntity {
            constructor(){
                super({x: 400, y: 400}, "test2.png", dimensions(20,20));
            }
            update(dt: number): void {
               
            }
        }

        //scene.addEntity(new OtherTest());

        // Drawing the collision grid
        class Debug extends DrawableEntity {
            update(dt: number): void {
                this.redraw();
            }
            draw(g: Graphics): void {
                g.clear();
                this.game.collisionManager.draw(g);
            }
        }
        // scene.addEntity(new Debug())
    }


    end(): void {
        this.emitter.destroy();
    }
   
}



class PhysicsDotEntity extends DrawableEntity {
    
    velocity = new Vec2(0,0);
    private gravity = new Vec2(0,.4);

    grounded = false;

    private drawRadius = 10;

    constructor(point: Coordinate){
        super();
        this.position.set(point);
        this.redraw();
    }



    draw(g: Graphics): void {
        g.beginFill(0x00FF00);
        g.drawCircle(this.x, this.y, this.drawRadius);
    }

    

    update(dt: number): void {

        if(this.grounded) return;

        // Gravity
        this.velocity.add(this.gravity);


        const destination = Vec2.add(this.velocity,this.position);

        // If no terrain hit, proceed
        const test = this.terrain.lineCollisionExt(this.position, destination);

        if(test === null){
            this.position.add(this.velocity);
        } else {

            if(this.velocity.length() <= 1){
                this.grounded = true;
            }
            // Could potentially bounce multiple times;

            let last_test = test;
            let distanceToMove = this.velocity.length();

            const max_iter = 20;
            let i = 0;
            while(distanceToMove > 0 && i++ < max_iter){


                const distanceToPoint = Vec2.subtract(last_test.point,this.position).length();

                const distanceAfterBounce = distanceToMove - distanceToPoint;

                // Set my position to colliding point, then do more logic later
                this.position.set(last_test.point);

                // Bounce off of wall, set elocity
                Vec2.bounce(this.velocity, last_test.normal, this.velocity);

                const lastStretchVel = this.velocity.clone().normalize().scale(distanceAfterBounce);

                const bounce_test = this.terrain.lineCollisionExt(this.position, Vec2.add(this.position, lastStretchVel));

                distanceToMove *= .9;
                this.velocity.scale(.9);

                distanceToMove -= lastStretchVel.length();


                if(bounce_test === null || bounce_test.normal.equals(last_test.normal) ){
                    this.position.add(lastStretchVel);

                    if(this.terrain.pointInTerrain(this.position)) this.grounded = true;
                    break;
                }

                last_test = bounce_test

                
            }

            
        }

        
        this.redraw(true);
    }


}







