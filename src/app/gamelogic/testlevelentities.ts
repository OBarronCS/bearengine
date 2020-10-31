import { Sprite } from "pixi.js";
import { BearEngine } from "../core-engine/bearengine";
import { Entity, GMEntity, SimpleKeyboardCheck, SimpleMovement, SpriteEntity } from "../core-engine/entity";
import { E } from "../core-engine/globals";
import { ColliderPart } from "../core-engine/parts";
import { Tilemap } from "../core-engine/tilemap";
import { ColorTween } from "../core-engine/tweening/tween";
import { rgb, Color } from "../math-library/color";
import { LiveGridGraph } from "../math-library/graphs";
import { floor, PI } from "../math-library/miscmath";
import { HermiteCurve } from "../math-library/paths";
import { QuadTree } from "../math-library/quadtree";
import { chance, randomRangeSet } from "../math-library/randomhelpers";
import { Line } from "../math-library/shapes/line";
import { Polygon } from "../math-library/shapes/polygon";
import { Rect, dimensions } from "../math-library/shapes/rectangle";
import { drawPoint } from "../math-library/shapes/shapedrawing";
import { Vec2, Coordinate, angleBetween } from "../math-library/shapes/vec2";
import { Player } from "./player";







export function loadTestLevel(this: BearEngine): void {

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

    // Drawing the collision grid
    class Debug extends Entity {
        update(dt: number): void {
            this.redraw();
        }
        draw(g: PIXI.Graphics): void {
            g.clear();
            E.Collision.draw(g);
        }
    }
    //this.addEntity(new Debug())

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

    // ASTAR GRID
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
                this.redraw();
            }

            if(E.Mouse.isDown("right")){
                console.time();
                this.grid.step_astar();
                this.redraw();
                console.timeEnd();
            }
        }

        draw(g: PIXI.Graphics): void {
            g.clear();
            g.moveTo(0,0);      
            this.grid.draw(g,30);
        }
    }
    //this.addEntity(new Test3());

    class FirstSprite extends GMEntity {
        constructor(spot: Coordinate){
            super(spot,"images/tree.gif");
            this.image.originPercent = ({x:.5, y:.5})
        }

        update(dt: number): void {
            // SimpleMovement(this,250 * dt);
            this.moveTowards(E.Mouse.position,21);
            this.image.angleTowardsPoint(E.Mouse.position, PI / 30);
        }

        draw(g: PIXI.Graphics): void {
            
        }
    }
    //this.addEntity(new FirstSprite({x:50,y:170}));


    class Q extends Entity {
        private tree = new QuadTree<Vec2>(2000,2000, a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(E.Keyboard.wasPressed("KeyF")){
                this.tree.insert(E.Mouse.position.clone());
                this.redraw();
            }
        }
        draw(g: PIXI.Graphics): void {
            g.clear();
            this.tree.draw(g);
        }
    }
    // this.addEntity(new Q())

    // Clockwise test
    class PolygonTest extends Entity {

        public p = Polygon.from([new Vec2(0,170),  new Vec2(150,0), new Vec2(0,0)]);

        constructor(){super(); this.redraw();}

        update(dt: number): void {
        
        }
        draw(g: PIXI.Graphics): void {
            this.p.draw(g);
        }

    }
    //this.addEntity(new PolygonTest());


    class Tilemaptest extends Entity {

        private map = new Tilemap(30,30,80,80);
        private testobject: SpriteEntity;

        constructor(){
            super();
            
            class test3 extends SpriteEntity {
                update(dt: number): void {}
                draw(g: PIXI.Graphics): void {}
            }

            this.testobject =  new test3(Vec2.ZERO, "images/flower.png");
            E.Engine.addEntity(this.testobject);

            for(let i = 1; i < 30; i++){
                for(const index of randomRangeSet(0,30,30)){
                    this.map.setCell(index,i);
                }
            }

            this.graphics.zIndex = -10000;
        }

        update(dt: number): void {
            this.redraw();
            const testMove = SimpleKeyboardCheck(6);
            this.testobject.position.add(this.map.potentialMove(this.testobject.collider.rect, testMove));
        }

        draw(g: PIXI.Graphics): void {
            g.clear();
           
            this.map.draw(g);
            this.testobject.collider.rect.draw(g);
            

            drawPoint(g,E.Mouse.position, this.map.isSolid(E.Mouse.position.x, E.Mouse.position.y) ? "0xFF0000":"0x0000FF");
        }


    }

    this.addEntity(new Tilemaptest());


}

