import { Graphics } from "pixi.js";
import { ColliderPart } from "shared/core/abstractpart";
import { bearevent } from "shared/core/bearevents";
import { Scene } from "shared/core/scene";
import { TiledMap } from "shared/core/tiledmapeditor";
import { dimensions } from "shared/shapes/rectangle";
import { Vec2 } from "shared/shapes/vec2";
import { BearEngine } from "../core-engine/bearengine";
import { DrawableEntity, Entity, GMEntity } from "../core-engine/entity";
import { GameLevel } from "../core-engine/gamelevel";
import { SpritePart } from "../core-engine/parts";
import { Player } from "./player";



export class FirstLevel extends GameLevel {
    
    path: string | TiledMap = "assets/firsttest.json";

    start(engine: BearEngine, scene: Scene): void {



        const p = scene.addEntity(new Player());

        console.log(scene.hasPart(p.entityID, ColliderPart));
        console.log(scene.hasPart(p.entityID, SpritePart));

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

        scene.addEntity(new SuperTest());

        class OtherTest extends GMEntity {
            constructor(){
                super({x: 400, y: 400}, "test2.png", dimensions(20,20));
            }
            update(dt: number): void {
               
            }
        }

        // Drawing the collision grid
        class Debug extends DrawableEntity {
            update(dt: number): void {
                this.redraw();
            }
            draw(g: Graphics): void {
                g.clear();
                this.engine.collisionManager.draw(g);
            }
        }
        // scene.addEntity(new Debug())

        scene.addEntity(new OtherTest());

    }


    end(engine: BearEngine): void {



    }


    update(dt: number): void {



    }

}