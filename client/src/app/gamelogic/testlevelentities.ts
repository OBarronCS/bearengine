
import { BearEngine } from "../core-engine/bearengine";
import { DrawableEntity, Entity, GMEntity, SpriteEntity } from "../core-engine/entity";
import { Player } from "./player";

import { Graphics } from "pixi.js";
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
import { drawCircle, drawLineArray, drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Vec2, Coordinate, angleBetween, mix } from "shared/shapes/vec2";
import { atan2, cos, floor, PI, second, sin } from "shared/miscmath";
import { ColorTween } from "shared/core/tween"
import { TickTimer } from "shared/ticktimer"
import { ColliderPart } from "shared/core/abstractpart";


class BasicSprite extends SpriteEntity {

    constructor(){
        super(Vec2.ZERO,"images/flower.png")
    }

    draw(g: Graphics): void {}
    update(dt: number): void {}

}


export function loadTestLevel(this: BearEngine): void {

    // this.addEntity(new BasicSprite())

    class CircleLineIntersectionTest extends DrawableEntity {
        
        private circle = new Vec2(0,0);
        
        private point = new Vec2(0,0);

        draw(g: Graphics): void {
            drawCircle(g, this.circle, 50)

            if(this.Mouse.wasPressed("left")) this.point = this.Mouse.position.clone();

            const otherPoint = this.Mouse.position.clone();

            drawLineBetweenPoints(g,this.point,otherPoint);

            const points = Line.CircleLineIntersection(this.point, otherPoint, this.circle.x, this.circle.y, 50);
            for(const point of points){
                drawPoint(g,point);
            }
        }
        update(dt: number): void {
            this.redraw()
        }

    }

    //this.addEntity(new CircleLineIntersectionTest);


    class PolygonCarveTest extends DrawableEntity {
       
        private poly = new PolygonCarving();
        private point: Vec2;

        private radius = 50;
        constructor(){
            super();
            console.log(this.poly.polygon.points);
        }

        update(dt: number): void {
            this.point = this.poly.polygon.closestPoint(this.Mouse.position);
           //console.log(this.point)
            if(this.Mouse.wasPressed("left")) this.poly.carveCircle(this.point.x, this.point.y, this.radius)
            
            this.redraw(true);
        }

        draw(g: Graphics): void {
            if(this.Keyboard.isDown("ArrowUp")) this.radius += 1
            if(this.Keyboard.isDown("ArrowDown")) this.radius -= 1
        
            drawCircle(g,this.point, this.radius)

            drawPoint(g,this.point,"#FF0000");
            
            
            this.poly.draw(g);
            
           
        }

   }

   this.addEntity(new PolygonCarveTest());


    class MouseRectCollider extends DrawableEntity {
        private r: ColliderPart;

        constructor(){
            super();
            this.addPart(this.r = new ColliderPart(dimensions(50,50), new Vec2(20,20)))
        }

        update(dt: number): void {
            this.position.set(this.Mouse.position);

            if(this.Keyboard.isDown("KeyK")) this.Engine.destroyEntity(this)

            this.redraw();
        }
        
        draw(g: Graphics): void {
            g.clear();
            this.r.rect.draw(g,0xFF0000);
        }
    }

    // this.addEntity(new MouseRectCollider());

    class TestCollision extends DrawableEntity {
        private line: Line;
        private r: Rect;
        constructor(){
            super();
            this.addPart(new ColliderPart(dimensions(50,50), new Vec2(20,20)))
            this.r = new Rect(100,150,50,50);
            this.line = new Line(new Vec2(0,0), new Vec2(0,0));
        }

        update(dt: number): void {
            this.line.B.set(this.Mouse.position);
            if(this.Mouse.wasPressed("left")){
                this.line.A.set(this.Mouse.position);
            }

            this.redraw();
        }
        
        draw(g: Graphics): void {
            g.clear();
            //this.r.draw(g)
            //this.line.draw(g,Rect.CollidesWithLine(this.r, this.line.A.x, this.line.A.y, this.line.B.x, this.line.B.y) ? "#FF0000":"#0000FF" );
        }
    }
    //this.addEntity(new TestCollision())

    // Drawing the collision grid
    class Debug extends DrawableEntity {
        update(dt: number): void {
            this.redraw();
        }
        draw(g: Graphics): void {
            g.clear();
            this.Collision.draw(g);
        }
    }
    //this.addEntity(new Debug())

    // Rectangle overlap test
    class Test extends DrawableEntity {
        
        private rec1 = new Rect(400,400,100,100);
        private anchorPoint = new Vec2(0,0);

        update(dt: number): void {
            if(this.Mouse.wasPressed("left")){
                this.anchorPoint.set(this.Mouse.position);
            }
            this.redraw()
        }

        draw(g: Graphics): void {
            g.clear();
            g.lineStyle(3, rgb(255,0,0).hex());
            this.rec1.draw(g, 0xFF0000);
    
            const rec2 = Rect.fromPoints(this.anchorPoint, this.Mouse.position);
            rec2.draw(g, 0x00FF00)

            const overlap =  this.rec1.intersection(rec2);
            if(overlap) overlap.draw(g,0x0000FF);

        }
    }
    //this.addEntity(new Test())

    // Color blend of hermite curve
    class Test2 extends DrawableEntity {
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

            this.Scene.addEntity(
                new ColorTween(this, "color", 5).from(this.color.clone()).to(rgb(255,5,5)).go()
            ).chain(new ColorTween(this, "color", 2).from((rgb(255,5,5))).to(rgb(1,0,255)))
        }

        update(dt: number): void {
            this.percent += +this.Mouse.isDown("left") * .01;
            this.percent %= 1;
            this.redraw()
        }

        draw(g: Graphics): void {
            g.clear();
            this.points.draw(g, this.color.hex());
        }
    }
    //this.addEntity(new Test2())

    // GRID QUADTREE
    class Quadquadtest extends DrawableEntity {
        
        private q = new LiveGridQuadTree(128);
        private scale = 16;

        constructor(){
            super();
            this.q.calculateEdges();
            this.redraw();
            this.canvas.graphics.addChild(this.hoverGraphic)
        }

        private hoverGraphic = new Graphics();

        private start = new Vec2(0,0);
        private target = new Vec2(0,0);

        private flip = false;


        update(dt: number): void {
            if(this.Mouse.isDown("left")){

                const x = floor(this.Mouse.position.x / this.scale);
                const y = floor(this.Mouse.position.y / this.scale)

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
            } else if(this.Keyboard.wasPressed("KeyE")){
                const x = floor(this.Mouse.position.x / this.scale);
                const y = floor(this.Mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.q.startPath(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
            } else if(this.Mouse.isDown("right")){
                 

                this.q.stepPath();
            
                this.redraw();
            }

            this.hoverGraphic.clear();

            const x = floor(this.Mouse.position.x / this.scale);
            const y = floor(this.Mouse.position.y / this.scale);

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
    class Test3 extends DrawableEntity {

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
            if(this.Mouse.isDown("left")){
                const x = floor(this.Mouse.position.x / this.scale);
                const y = floor(this.Mouse.position.y / this.scale);
                
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
            } else if(this.Keyboard.wasPressed("KeyE")){
                const x = floor(this.Mouse.position.x / this.scale);
                const y = floor(this.Mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.grid.start_astar(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
                
            } else if(this.Mouse.isDown("right")){
                this.grid.step_astar();
                this.redraw();
            }
        }

        draw(g: Graphics): void {
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
            this.moveTowards(this.Mouse.position,21);
            this.image.angleTowardsPoint(this.Mouse.position, PI / 30);
        }

        draw(g: Graphics): void {
            
        }
    }
    //this.addEntity(new FirstSprite({x:50,y:170}));


    // Quadtree drawing test
    class Q extends DrawableEntity {
        private tree = new QuadTree<Vec2>(2000,2000, a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(this.Keyboard.wasPressed("KeyF")){
                this.tree.insert(this.Mouse.position.clone());
                this.redraw();
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.tree.draw(g);
        }
    }
    //this.addEntity(new Q())

    // Clockwise test
    class PolygonTest extends DrawableEntity {

        public p = Polygon.from([new Vec2(0,170),  new Vec2(150,0), new Vec2(0,0)]);

        constructor(){super(); this.redraw();}

        update(dt: number): void {}

        draw(g: Graphics): void {
            this.p.draw(g);
        }
    }
    
    // this.addEntity(new PolygonTest());

    // TileMap collision
    class Tilemaptest extends DrawableEntity {

        private map = new Tilemap(30,30,80,80);
        private testobject: SpriteEntity;

        constructor(){
            super();
            
            class test3 extends SpriteEntity {
                update(dt: number): void {}
                draw(g: Graphics): void {}
            }

            this.testobject =  new test3(Vec2.ZERO, "images/flower.png");
            this.Engine.addEntity(this.testobject);

            for(let i = 1; i < 30; i++){
                for(const index of randomRangeSet(0,30,30)){
                    this.map.setCell(index,i);
                }
            }

            this.canvas.graphics.zIndex = -10000;
        }

        update(dt: number): void {
            this.redraw();
            const testMove = this.simpleKeyboardCheck(6);
            this.testobject.position.add(this.map.potentialMove(this.testobject.collider.rect, testMove));
        }

        draw(g: Graphics): void {
            g.clear();
           
            this.map.draw(g);
            this.testobject.collider.rect.draw(g);
            

            drawPoint(g,this.Mouse.position, this.map.isSolid(this.Mouse.position.x, this.Mouse.position.y) ? "0xFF0000":"0x0000FF");
        }


    }

    //this.addEntity(new Tilemaptest());


    class conwaytest extends DrawableEntity {

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

    class LightningTest extends DrawableEntity {

        private startPoint = Vec2.ZERO;

        private lines: Line[] = [];

        private ticker = new TickTimer(6);

        update(dt: number): void {
            if(!this.ticker.tick()) return;
            this.lines = [];
            if(this.Mouse.wasPressed("left")){
                this.startPoint = this.Mouse.position.clone();
            }
            const mousePoint = this.Mouse.position.clone();

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
    class SpatialTest extends DrawableEntity {
        private sparse = new SparseGrid<Vec2>(1000,1000,10,10,a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(this.Keyboard.wasPressed("KeyF")){
                this.sparse.insert(this.Mouse.position.clone());
                this.redraw();
                console.log(this.sparse["hashmap"]["arr"])
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.sparse.draw(g);
        }
    }
    // this.addEntity(new SpatialTest())


    class LineCloseTest extends DrawableEntity {

        private line = new Line(new Vec2(100,60), new Vec2(10,200));
        private p = this.redraw()

        update(dt: number): void {
            this.redraw();
        }
        draw(g: Graphics): void {
            g.clear();
            this.line.draw(g);
            drawPoint(g,this.line.pointClosestTo(this.Mouse.position));
        }

    }
    //this.addEntity(new LineCloseTest());


    class DynAABBTest extends DrawableEntity {
        
        private tree = new DynamicAABBTree();

        update(dt: number): void {
            if(this.Mouse.wasPressed("left")){
                this.tree.insert(new Ellipse(this.Mouse.position.clone(),40,40))
                console.log(this.tree["root"])
                this.redraw();
            }

            this.tree.pointQueryTestNodes(this.Mouse.position).forEach(e => e.aabb.draw(this.canvas.graphics,0x00F0FF));
        }
        draw(g: Graphics): void {
            g.clear();
            this.tree.draw(g);
        }

    }
    //this.addEntity(new DynAABBTest());


    class IK extends DrawableEntity {
        
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

            let target = this.Mouse.position.clone() as Coordinate;
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




class PolygonCarving {


    private additionalPolygons: Polygon[] = [];
    polygon = Polygon.from([
        new Vec2(0,0),
        new Vec2(0,1000),
        new Vec2(100,1000),
        new Vec2(100,300),
        new Vec2(200,300),
        new Vec2(200,1000),
        new Vec2(300,1000),
        new Vec2(300,300),
        new Vec2(400,300),
        new Vec2(400,1000),
        new Vec2(500,1000),
        new Vec2(500,0),
    ]);

    constructor(){}
    
    public carveCircle(x: number,y: number, r: number){
        /* 
        1) Add points into the polygon point array into the right spots
        2) Delete all original points that are inside the circle
        3) Add circle points in the correct place, and creating new polygons if needed
        */

        const circle = new Ellipse(new Vec2(x,y),r,r);

        // contains the points of the resulting polygon
        const newPoints: Vec2[] = []

        // contains the indices in the newPoints array of the new collision points'
        const addedIndices: number[] = [];

        for(let i = 0; i < this.polygon.points.length; i++){
            const point =  this.polygon.points[i];
            const secondPoint = this.polygon.points[(i + 1) % this.polygon.points.length];
            const collisionPoints = Line.CircleLineIntersection(point, secondPoint, x, y, r);
            
            if(!circle.contains(point)) newPoints.push(point);
            for(const point of collisionPoints){
                newPoints.push(point);
                addedIndices.push(newPoints.length - 1);
            }  
        }

        // If NO points remain,
        if(newPoints.length === 0){
            this.polygon = null;
            return;
        }

        // Sort the added indices by the points angle to the center of the sphere 
        addedIndices.sort((a,b) => {
            const p1 = newPoints[a];
            const p2 = newPoints[b];

            let p1Angle = atan2(p1.y - y, p1.x - x);
            let p2Angle = atan2(p2.y - y, p2.x - x);

            console.log(p1Angle, p2Angle)
            return p2Angle - p1Angle;
        })

        console.log("Indices: ", addedIndices);
        console.log("Points: ", newPoints)

        // Algorithm 2.0: Here we go

        // Test the space between the first two points to determine the offset 
        let offset = 0;

        const p1 = newPoints[addedIndices[0]];
        const p2 = newPoints[addedIndices[1]];

        const startAngle = atan2(p1.y - y,p1.x - x);
        const endAngle = atan2(p2.y - y,p2.x - x);
        
        // Test going clockwise, like all points will be added
        const testOffset = -0.05;
        
        const testPoint = new Vec2(x + cos(startAngle + testOffset) * r, y + sin(startAngle + testOffset) * r);
        console.log(testPoint)
        if(!this.polygon.contains(testPoint)){
            console.log("OFFSET")
            offset = 1;
        }


        // parralel array of connected components
        const islands: number[] = [];
        islands.length = newPoints.length;
        islands.fill(0);

        let freeIslandNumber = 0;

        // Key is the index where we add the points
        const addedCirclePointMap: Map<number,Vec2[]> = new Map();
        
        // Cycles through points and creates ALL the disconnected components
        for(let i = 0; i < addedIndices.length; i += 2){
            const ii = (i + offset) % addedIndices.length;
            const ii2 = (ii + 1) % addedIndices.length;

            // Index inside of the newPoints array denoting the beginning and end of where points should be filled in
            // Move clockwise (right) from index until get to index2. Will wrap around array at times.
            const index = addedIndices[ii];
            const index2 = addedIndices[ii2];

            freeIslandNumber += 1;

            // this and islands[index2] should always be equal
            const islandNumber = islands[index];

            let j = index;
            while(j !== index2){
                // Essentially, if this point doesn't belong to another group already
                if(islands[j] === islandNumber){
                    islands[j] = freeIslandNumber;
                }

                j = (j + 1) % newPoints.length;
            }

            // Add index2 as well. j == index2 here
            islands[j] = freeIslandNumber;

            // CREATING THE CIRCLE POINTS:
            
            const p1 = newPoints[index];
            const p2 = newPoints[index2];

            let startAngle = atan2(p1.y - y,p1.x - x);
            let endAngle = atan2(p2.y - y,p2.x - x);
            
            const VERTICES = 14;
            const initialOffset =  Math.PI * 2 / VERTICES // used to make sure points don't repeat

            if(endAngle > startAngle) endAngle -= 2 * PI;

            const circlePoints: Vec2[] = [];

            for(let i = startAngle - initialOffset; i > endAngle; i -= Math.PI * 2 / VERTICES)
                circlePoints.push(new Vec2(x + cos(i) * r, y + sin(i) * r));

            // reverse it due to the opposite ordering.
            addedCirclePointMap.set(index2, circlePoints.reverse());

        }

        //Now, we have created all the disconnected 'islands' of points (defined in islands array), we just need to make them seperate polygon objects
        // And add the points from the circle

        console.log(freeIslandNumber)
        console.log(islands)

        const components: Vec2[][] = [];

        // Each free number creates either nothing, or it creats an entire 
        for(let i = 0; i <= freeIslandNumber; i++){

            const points: Vec2[] = [];

            for(let j = 0; j < newPoints.length; j++){
                // remember, newPoints and island are parralel arrays
                if(islands[j] === i){
                    points.push(newPoints[j]);

                    const possibleAddedPoints = addedCirclePointMap.get(j);
                    if(possibleAddedPoints !== undefined){
                        points.push(...possibleAddedPoints);
                    }
                }
            }

            if(points.length !== 0) components.push(points);
        }


        
        

   

        this.polygon = Polygon.from(components[0]);

        for(let i = 1; i < components.length; i++){
            this.additionalPolygons.push(Polygon.from(components[i]));
        }
    }   

    draw(g: Graphics){
        this.polygon.draw(g,0x0000FF);
        for(const poly of this.additionalPolygons){
            poly.draw(g, 0x00FF00)
        }
    }

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

