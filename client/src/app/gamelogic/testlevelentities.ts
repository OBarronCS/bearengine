
import { BearEngine } from "../core-engine/bearengine";
import { Entity, GMEntity, SimpleKeyboardCheck, SimpleMovement, SpriteEntity } from "../core-engine/entity";
import { E } from "../core-engine/globals";
import { Player } from "./player";

import { Graphics } from "pixi.js";
import { ColliderPart } from "shared/core/sharedparts"
import { Tilemap } from "shared/datastructures/tilemap";
import { rgb, Color } from "shared/datastructures/color";
import { DynamicAABBTree } from "shared/datastructures/dynaabbtree";
import { GraphNode, LiveGridGraph } from "shared/datastructures/graphs";
import { SparseGrid } from "shared/datastructures/hashtable";
import { HermiteCurve } from "shared/datastructures/paths";
import { GridQuadNode, GridQuadTree, LiveGridQuadTree, QuadTree } from "shared/datastructures/quadtree";
import { chance, fillFunction, random, randomRangeSet, random_range } from "shared/randomhelpers";
import { Ellipse } from "shared/shapes/ellipse";
import { Line } from "shared/shapes/line";
import { Polygon } from "shared/shapes/polygon";
import { Rect, dimensions } from "shared/shapes/rectangle";
import { drawLineArray, drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Vec2, Coordinate, angleBetween, mix } from "shared/shapes/vec2";
import { floor, PI } from "shared/miscmath";
import { ColorTween } from "shared/core/tween"
import { TickTimer } from "shared/ticktimer"



export function loadTestLevel(this: BearEngine): void {

    this.addEntity(new Player())


    class MouseRectCollider extends Entity {
        private r: ColliderPart;

        constructor(){
            super();
            this.addPart(this.r = new ColliderPart(dimensions(50,50), new Vec2(20,20)))
        }

        update(dt: number): void {
            this.position.set(E.Mouse.position);

            if(E.Keyboard.isDown("KeyK")) E.Engine.destroyEntity(this)

            this.redraw();
        }
        
        draw(g: PIXI.Graphics): void {
            g.clear();
            this.r.rect.draw(g,0xFF0000)

        }
    }

    // this.addEntity(new MouseRectCollider());

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
            //this.r.draw(g)
            //this.line.draw(g,Rect.CollidesWithLine(this.r, this.line.A.x, this.line.A.y, this.line.B.x, this.line.B.y) ? "#FF0000":"#0000FF" );
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
            g.lineStyle(3, rgb(255,0,0).hex());
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
            this.points.draw(g, this.color.hex());
        }
    }
    //this.addEntity(new Test2())

    // GRID QUADTREE
    class Quadquadtest extends Entity {
        
        private q = new LiveGridQuadTree(128);
        private scale = 16;

        constructor(){
            super();
            this.q.calculateEdges();
            this.redraw();
            this.graphics.addChild(this.hoverGraphic)
        }

        private hoverGraphic = new Graphics();

        private start = new Vec2(0,0);
        private target = new Vec2(0,0);

        private flip = false;


        update(dt: number): void {
            if(E.Mouse.isDown("left")){

                const x = floor(E.Mouse.position.x / this.scale);
                const y = floor(E.Mouse.position.y / this.scale)

                this.q.insert(x,y);
                

                this.q.insert(x+1,y);
                this.q.insert(x-1,y);
                this.q.insert(x,y+1);
                this.q.insert(x,y-1);

                this.q.insert(x+1,y+1);
                this.q.insert(x+1,y-1);
                this.q.insert(x-1,y+1);
                this.q.insert(x-1,y-1);

                this.q.calculateEdges();

                this.q.startPath(this.start.x, this.start.y, this.target.x, this.target.y);

                this.redraw();
            } else if(E.Keyboard.wasPressed("KeyE")){
                const x = floor(E.Mouse.position.x / this.scale);
                const y = floor(E.Mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.q.startPath(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
            } else if(E.Mouse.isDown("right")){
                 

                this.q.stepPath();
            
                this.redraw();
            }

            this.hoverGraphic.clear();

            const x = floor(E.Mouse.position.x / this.scale);
            const y = floor(E.Mouse.position.y / this.scale);

            const node = this.q.getNode(x,y)
            if(node !== null) node.draw(this.hoverGraphic,this.scale, 9, 0x0000FF);
        }

        draw(g: Graphics): void {
            g.clear();

            this.q.draw(g,this.scale);
        }

    }

    //this.addEntity(new Quadquadtest())

    // ASTAR GRID
    class Test3 extends Entity {

        private grid = new LiveGridGraph(128,128);

        private scale = 16;

        constructor() {
            super();
            this.grid.start_astar(0,0,24,12);
            this.grid.step_astar();

            this.redraw();
        }

        private start = new Vec2(0,0);
        private target = new Vec2(0,0);

        private flip = false;

        update(dt: number): void {
            if(E.Mouse.isDown("left")){
                const x = floor(E.Mouse.position.x / this.scale);
                const y = floor(E.Mouse.position.y / this.scale);
                
                this.grid.blockcell(x,y);

                this.grid.blockcell(x+1,y);
                this.grid.blockcell(x-1,y);
                this.grid.blockcell(x,y+1);
                this.grid.blockcell(x,y-1);

                this.grid.blockcell(x+1,y+1);
                this.grid.blockcell(x+1,y-1);
                this.grid.blockcell(x-1,y+1);
                this.grid.blockcell(x-1,y-1);

                this.grid.start_astar(this.start.x, this.start.y, this.target.x, this.target.y);
                
                this.redraw();
            } else if(E.Keyboard.wasPressed("KeyE")){
                const x = floor(E.Mouse.position.x / this.scale);
                const y = floor(E.Mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.grid.start_astar(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
                
            } else if(E.Mouse.isDown("right")){
                this.grid.step_astar();
                this.redraw();
            }
        }

        draw(g: PIXI.Graphics): void {
            g.clear();
            g.x = this.scale * 128;   
            this.grid.draw(g,this.scale);
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


    // Quadtree drawing test
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
    //this.addEntity(new Q())

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
    
    // this.addEntity(new PolygonTest());

    // TileMap collision
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

    //this.addEntity(new Tilemaptest());


    class conwaytest extends Entity {

        private conway = new ConwaysLife(60,60);
        private accumulation = -.5;

        constructor(){
            super();
            for(let i = 0; i < 60; i++){
                for(const index of randomRangeSet(0,60,20)){
                    this.conway.makeCellAlive(i,index);
                }
            }
            this.redraw()

        }

        update(dt: number): void {
            this.accumulation += dt;
            if(this.accumulation > .1){
                this.conway.updategrid();
                this.redraw();
                this.accumulation = 0;
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.conway.draw(g);
        }

    }
    //this.addEntity(new conwaytest())

    class LightningTest extends Entity {

        private startPoint = Vec2.ZERO;

        private lines: Line[] = [];

        private ticker = new TickTimer(6);

        update(dt: number): void {
            if(!this.ticker.tick()) return;
            this.lines = [];
            if(E.Mouse.wasPressed("left")){
                this.startPoint = E.Mouse.position.clone();
            }
            const mousePoint = E.Mouse.position.clone();

            this.lines.push(new Line(this.startPoint, mousePoint));
            
            // the longer the distance, the bigger this needs to be
            // so the lightning looks natural
            let offset =150;

           
            // how many times do we cut the segment in half?
            for (let i = 0; i < 5; i++) {

                const newLines: Line[] = [];

                for(const line of this.lines){
                    const midPoint = mix(line.A, line.B, .5);
                    
                    midPoint.add(Line.normal(line.A, line.B).extend(random_range(-offset,offset)));

                    newLines.push(new Line(line.A, midPoint))
                    newLines.push(new Line(midPoint, line.B));

                    /// sometimes, split!
                    if(chance(18)){
                        const dir = Vec2.subtract(midPoint, line.A);
                        dir.drotate(random_range(-30,30)).scale(.7).add(midPoint);
                        newLines.push(new Line(midPoint, dir));
                    }
                }

                this.lines = newLines;
                offset /= 2;
            }

            

            this.redraw();
        }


        draw(g: Graphics): void {
            g.clear();
            for(const line of this.lines){
                line.draw(g,"#FFFFFF");
            }
        }

    }
    //this.addEntity(new LightningTest());
    
    // Quadtree drawing test
    class SpatialTest extends Entity {
        private sparse = new SparseGrid<Vec2>(1000,1000,10,10,a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(E.Keyboard.wasPressed("KeyF")){
                this.sparse.insert(E.Mouse.position.clone());
                this.redraw();
                console.log(this.sparse["hashmap"]["arr"])
            }
        }
        draw(g: PIXI.Graphics): void {
            g.clear();
            this.sparse.draw(g);
        }
    }
    // this.addEntity(new SpatialTest())


    class LineCloseTest extends Entity {

        private line = new Line(new Vec2(100,60), new Vec2(10,200));
        private p = this.redraw()

        update(dt: number): void {
            this.redraw();
        }
        draw(g: Graphics): void {
            g.clear();
            this.line.draw(g);
            drawPoint(g,this.line.pointClosestTo(E.Mouse.position));
        }

    }
    //this.addEntity(new LineCloseTest());


    class DynAABBTest extends Entity {
        
        private tree = new DynamicAABBTree();

        update(dt: number): void {
            if(E.Mouse.wasPressed("left")){
                this.tree.insert(new Ellipse(E.Mouse.position.clone(),40,40))
                console.log(this.tree["root"])
                this.redraw();
            }

            this.tree.pointQueryTestNodes(E.Mouse.position).forEach(e => e.aabb.draw(this.graphics,0x00F0FF));
        }
        draw(g: Graphics): void {
            g.clear();
            this.tree.draw(g);
        }

    }
    //this.addEntity(new DynAABBTest());


    class IK extends Entity {
        
        private points: Vec2[] = []

        constructor(){
            super();

            const segments = 25;
            const length = 50;

            for(let i = 0; i < segments; i++){
                this.points.push(
                    new Vec2(i * length, 0)
                    )
            }
        }

        update(dt: number): void {

            let target = E.Mouse.position.clone() as Coordinate;
            const base = this.points[this.points.length - 1].clone();

            for (let i = 0; i < this.points.length - 1; i++) {
                const newTail = this.moveSegment(this.points[i], this.points[i + 1], target);
                // This modifies the vectors. They are now in the correct positions
                target = newTail;
            }       
            this.points[this.points.length - 1].set(target);

            target = base;
            for (let i = this.points.length - 1; i > 0; i--){
                const newTail = this.moveSegment(this.points[i], this.points[i - 1], target);
                target = newTail
            }
            this.points[0].set(target);

            this.redraw()
        }

        moveSegment(head: Vec2, tail: Vec2, target: Coordinate){
            const length = Vec2.distance(head, tail);
            
            const tempLength = Vec2.distance(tail, target);

            const scale = length / tempLength;

            head.set(target);
            // returns the new tail:
            return {
                x: target.x + ((tail.x - target.x) * scale),
                y: target.y + ((tail.y - target.y) * scale)
            }
        }


        draw(g: Graphics): void {
            g.clear();
            drawPoint(g, this.points[0])
            drawLineArray(g, this.points, 0xFF0000, false)
        }

    }
    //this.addEntity(new IK())


    
}



class ConwaysLife {

    //true = alive
    private grid: boolean[][];

    private width:number;
    private height:number;

    constructor(w: number, h: number){
        this.width = w;
        this.height = h;

        this.grid = [];

        for(let i = 0; i < w; i++){
            this.grid[i] = [];
            this.grid[i].length = h;
            this.grid[i].fill(false);
        }
    }

    numberOfNeighbours(g: boolean[][], x: number, y:number): number {
        // UNCOMMENT THIS LINE FOR COOL ART
        //g = this.grid;
        let total = 0;
        
        //left
        if(x - 1 >= 0){
            total += +g[x-1][y]

            //left top
            if(y - 1 >= 0){
                total += +g[x - 1][y-1]
            }
    
            //left bot
            if(y + 1 < this.height){
                total += +g[x - 1][y + 1]
            }
        }

        if(x + 1 < this.width){
            total += +g[x+1][y]
            //left top
            if(y - 1 >= 0){
                total += +g[x + 1][y-1]
            }
    
            //left bot
            if(y + 1 < this.height){
                total += +g[x + 1][y + 1]
            }
        }

        if(y - 1 >= 0){
            total += +g[x][y-1]
        }

        if(y + 1 < this.height){
            total += +g[x][y + 1]
        }


        return total;
    }

    makeCellAlive(x: number,y: number){
        this.grid[x][y] = true;
    }

    updategrid(){
        const gridcopy: boolean[][] = [];
        for(let i = 0; i < this.width; i++){
            gridcopy[i] = [];
            for(let j = 0; j < this.height; j++){
                gridcopy[i][j] = this.grid[i][j];
            }
        }
       
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){
                const n = this.numberOfNeighbours(gridcopy,i,j);
            
                // if its alive right now
                if(gridcopy[i][j]){
                    if(n < 2){
                        this.grid[i][j] = false;
                    } else if (n === 2 || n === 3){
                        this.grid[i][j] = true;
                    // IF THIS IS CHANGE TO n > 3, in addition to other other change in neighbour getting, you can make some cool art
                    } else if (n >= 3){
                        this.grid[i][j] = false;
                    } 
                } else {
                    if(n === 3){
                        this.grid[i][j] = true;
                    }
                }
            }
        }
    }


    draw(g: Graphics, scale = 10){
        // black = alive
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){

                // White if alive
                if(!this.grid[i][j]){
                    g.beginFill(0x000000);
                } else {
                    g.beginFill(0xFFFFFF)
                }

                g.drawRect(i * scale, j * scale,scale,scale);
            }
        }
    }

}

