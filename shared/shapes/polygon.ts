import { Shape } from "./shapesinterfaces";
import { Coordinate, Vec2, mix, flattenVecArray } from "./vec2";
import { Rect } from "./rectangle";
import { abs, atan2, niceColor } from "../miscmath";

import type { Graphics, Point } from "pixi.js";

import { default as earcut } from "earcut";

import { drawPoint, drawVecAsArrow } from "./shapedrawing";
import { Line } from "./line";


// Test for concavity: http://paulbourke.net/geometry/polygonmesh/
// TODO: more optimized clockwise test for 3 points, and hull calculation.

export class Polygon implements Shape<Polygon>{
   
    points: Vec2[] = [];
    normals: Vec2[] = [];

    constructor(points: Vec2[], normals: Vec2[]){
        this.points = points;
        this.normals = normals;
    }

    /** Automatically create normals, puts points into clockwise ordered */
    static from(points: Vec2[]): Polygon {

        if(!Polygon.isClockwise(points)){
            // console.log("NOT CLOCKWISE")
            points.reverse();
        }

        const normals: Vec2[] = []
        let m: number;
        for(let n = 0; n < points.length; n++){
            m = n + 1;
            if(m === points.length){ m = 0; }

            const p1 = points[n]
            const p2 = points[m]

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;

            const magnitude = Math.sqrt((dx * dx) + (dy * dy));
            // If not clockwise, negate this vector
            normals.push(new Vec2(dy/magnitude, -dx/magnitude));
        }

        return new Polygon(points,normals);
    }

    static SignedArea(points: Vec2[]): number {
        //http://paulbourke.net/geometry/polygonmesh/ 
        let area = 0;
        let k = points.length - 1;
        for (let i = 0; i < points.length; k = i++){
            const p1 = points[k];
            const p2 = points[i];
            
            area += (p1.x * p2.y) - (p2.x * p1.y)
        }

        return area / 2;
    }

    static isClockwise(vecs: Vec2[]): boolean {
        return Polygon.SignedArea(vecs) < 0
    }

    clone(): Polygon {
        const copy_points = this.points.slice(0);
        const copy_normals = this.normals.slice(0);

        return new Polygon(copy_points, copy_normals);
    }


    contains(point: Coordinate): boolean {
        const testx = point.x;
        const testy = point.y;

        //https://wrf.ecse.rpi.edu//Research/Short_Notes/pnpoly.html
        const nvert = this.points.length;
        let i = 0;
        let j = nvert - 1; 
        let c = false;
        for (; i < nvert; j = i++) {
            let point = this.points[i];
            let last_point = this.points[j];
            
            if ( ((point.y>testy) != (last_point.y>testy)) &&
                (testx < (last_point.x-point.x) * (testy-point.y) / (last_point.y-point.y) + point.x) )
                c = !c;
        }
        return c;
    }

    copyFrom(shape: Polygon): this {
        this.points = shape.points.slice(0);
        this.normals = shape.normals.slice(0);
        return this;
    }

    copyTo(shape: Polygon): Polygon {
        return shape.copyFrom(this);
    }

    centroid(): Vec2 {
        const area = this.signedArea();

        let centerX = 0;
        let centerY = 0;
        
        for (let i = 0; i < this.points.length; i++) {
            let j = i + 1;
            if(j === this.points.length){ j = 0; } 

            centerX += (this.points[i].x + this.points[j].x) * ( (this.points[i].x * this.points[j].y) - (this.points[j].x * this.points[i].y) );
            centerY += (this.points[i].y + this.points[j].y) * ( (this.points[i].x * this.points[j].y) - (this.points[j].x * this.points[i].y) );
        }

        centerX /= (area * 6);
        centerY /= (area * 6);
        return new Vec2(centerX, centerY);
    }

    signedArea(): number {
        return Polygon.SignedArea(this.points);
    }

    area(): number {
        return abs(this.signedArea());
    }


    getAABB(): Rect {
        const topleft = minPoint(this.points);
        const botright = maxPoint(this.points);

        return new Rect(topleft.x, topleft.y, botright.x - topleft.x, botright.y - topleft.y)
    }

    draw(g: Graphics, color: number = niceColor(), normals = true): void {
        g.lineStyle(3,color,.9);
        g.endFill()
        g.drawPolygon(this.points as unknown as Point[])

        // draw points
        for(const point of this.points){
            drawPoint(g, point)
        }

        // Draw normals

        if(normals){
            for(let i = 0; i < this.normals.length; i++){
                let j = i + 1;
                if(j == this.points.length) j = 0;
                const p1 = this.points[i];
                const p2 = this.points[j]
                
                const half_way = mix(p1, p2, .5);

                drawVecAsArrow(g,this.normals[i], half_way.x, half_way.y, 50);
            }
        }
    }

    //https://en.wikipedia.org/wiki/Graham_scan
    convexhull(): Polygon {
        // Get the highest point, if tie, leftmost
        let top = this.points[0];
        for(let i = 1; i < this.points.length; i++){
            const point = this.points[i];

            if(point.y < top.y){
                top = point;
            } else if(point.y === top.y){
                if(point.x < top.x){
                    top = point;
                }
            }
        }
        // TODO --> move to a method that doesn't involve atan2 calls
        // Now order by ascending angle compared to this first point
        // first get rid of the point itself
        let orderedPoints = this.points.filter(value => value !== top)
        orderedPoints.sort((a,b) => {
            const angleToA = atan2(a.y - top.y, a.x - top.x);
            const angleToB = atan2(b.y - top.y, b.x - top.x);

            return angleToA - angleToB;
        })
        // Theres an error here, if two points have the same angle, the whole thing breaks
        // have to choose the farthest point from top in those cases
        for(let i = 0; i < orderedPoints.length - 1; i++){
            const a = orderedPoints[i];
            const b = orderedPoints[i + 1];
            const angleToA = atan2(a.y - top.y, a.x - top.x);
            const angleToB = atan2(b.y - top.y, b.x - top.x);
            if(angleToA === angleToB){
                const distanceA = Vec2.distanceSquared(a, top);
                const distanceB = Vec2.distanceSquared(b, top);

                // if first point is farther, splice second one
                if(distanceA > distanceB){
                    orderedPoints.splice(i+1,1);
                } else {
                    orderedPoints.splice(i ,1);
                }
                i--;
            }
        }


        // return true if three points are clockwise 
        function clockwise(point1: Vec2, point2: Vec2, point3: Vec2): boolean {
            const angleTo3 = atan2(point3.y - point1.y, point3.x - point1.x); 
            const angleTo2 = atan2(point2.y - point1.y, point2.x - point1.x);
            return angleTo3 <= angleTo2;
        }

        const final_points: Vec2[] = [top];

        for(const point of orderedPoints){
            while(final_points.length > 1 && clockwise(final_points[final_points.length - 2], final_points[final_points.length - 1], point)){
                final_points.pop()
            }
            final_points.push(point)
        }


        //// AHHHHHh CHANGE THIS
        return Polygon.from(final_points);
    }

    // Returns array of polygons that are triangles. No normals
    triangulate(): Polygon[] {
        const flatArray = flattenVecArray(this.points);
        const coords = earcut(flatArray);
        // returns the indices of new triangles
        // [0,1,3,   1,2,3]  --> two triangles, each number corresponds to an input point
        const polygons: Polygon[] = []
        for(let i = 0; i < coords.length; i += 3){
            const p1 = new Vec2(flatArray[coords[i]*2],flatArray[(coords[i]*2) + 1])
            const p2 = new Vec2(flatArray[(coords[i+1])*2],flatArray[((coords[i+1])*2) + 1])
            const p3 = new Vec2(flatArray[(coords[i+2])*2],flatArray[((coords[i+2])*2) + 1])
            polygons.push(new Polygon([p1,p2,p3],[]))
        }
        return polygons;
    }

    closestPoint(testPoint: Coordinate){
        let closestPoint: Vec2 = null;
        let distance = 0;
        

        let j = this.points.length - 1;
        for(let i = 0; i < this.points.length; j = i++){
            const point = Line.PointClosestToLine(this.points[j], this.points[i], testPoint)
        
            const testDistance = Vec2.distanceSquared(testPoint, point)

            if(closestPoint === null || testDistance < distance){
                distance = testDistance;
                closestPoint = point;

            }
        }
        return closestPoint;
    }

    toPolygon(): Polygon {
        return this.clone();
    }
}



/** Top left AABB
 *  Takes in array of coordinates, returns a coordinate with the min x and min y of all points
 * @param array 
 */
export function minPoint(array: Coordinate[]): Coordinate{
    let left = array[0].x;
    for(let i = 1; i < array.length; i++){
        if(array[i].x < left){
            left = array[i].x;
        }
    }

    let top = array[0].y;
    for(let i = 1; i < array.length; i++){
        if(array[i].y < top){
            top = array[i].y;
        }
    }

    return {x: left, y: top}
}

// BOT RIGHT AABB
export function maxPoint(array: Coordinate[]): Coordinate{
    let right = array[0].x;
    for(let i = 1; i < array.length; i++){
        if(array[i].x > right){
            right = array[i].x;
        }
    }

    let bot = array[0].y;
    for(let i = 1; i < array.length; i++){
        if(array[i].y > bot){
            bot = array[i].y;
        }
    }

    return {x:right, y:bot}
}


