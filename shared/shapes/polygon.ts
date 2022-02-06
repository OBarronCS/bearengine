import { Shape } from "./shapesinterfaces";
import { Coordinate, Vec2, mix, flattenVecArray, distanceSquared } from "./vec2";
import { Rect } from "./rectangle";
import { abs, atan2, ceil, cos, floor, max, min, niceColor, PI, sign, sin, TWO_PI } from "../misc/mathutils";

import type { Graphics, Point } from "shared/graphics/graphics";

import { default as earcut } from "earcut";

import { drawPoint, drawVecAsArrow } from "./shapedrawing";
import { Line } from "./line";
import { random } from "shared/misc/random";
import { swap } from "shared/datastructures/arrayutils";
import { Ellipse } from "./ellipse";


// total === completely gone. missed === completely intact. normal === hit
export type CarveResult = {type:"missed"} | {type:"total"} | {type:"normal", parts: Polygon[]}; 

// Test for concavity: http://paulbourke.net/geometry/polygonmesh/
export class Polygon implements Shape<Polygon> {
   
    // These arrays are the same length. ex: 4 points = 4 edges
    points: readonly Vec2[] = [];
    normals: readonly Vec2[] = [];

    constructor(points: Vec2[], normals: Vec2[]){
        this.points = points;
        this.normals = normals;
    }

    static random(vertices: number, MAX_LENGTH = 1000): Polygon {

        const points: Vec2[] = [];

        for(let i = 0; i < TWO_PI; i += TWO_PI / vertices){
            points.push(new Vec2(cos(i) * random(MAX_LENGTH), sin(i) * random(MAX_LENGTH)))
        }

        points.sort((a,b) => {
            const p1Angle = atan2(a.y, a.x);
            const p2Angle = atan2(b.y, b.x);
            return p1Angle - p2Angle;
        });


        return Polygon.from(points);
    }

    /** Automatically create normals, puts points into clockwise order */
    static from(points: Vec2[]): Polygon {

        if(!Polygon.is_clockwise(points)){
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

    static signed_area(points: readonly Vec2[]): number {
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

    static is_clockwise(vecs: Vec2[]): boolean {
        return Polygon.signed_area(vecs) < 0
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
        const area = this.signed_area();

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

    signed_area(): number {
        return Polygon.signed_area(this.points);
    }

    area(): number {
        return abs(this.signed_area());
    }

    getAABB(): Rect {
        const topleft = minPoint(this.points);
        const botright = maxPoint(this.points);

        return new Rect(topleft.x, topleft.y, botright.x - topleft.x, botright.y - topleft.y)
    }

    //https://en.wikipedia.org/wiki/Graham_scan
    convexhull(): Polygon {
        // Get the highest point (lowest y), if tie, leftmost
        let top = this.points[0];
        let index = 0;
        for(let i = 1; i < this.points.length; i++){
            const point = this.points[i];

            if(point.y < top.y){
                top = point;
                index = i;
            } else if(point.y === top.y){
                if(point.x < top.x){
                    top = point;
                    index = i;
                }
            }
        }
        const orderedPoints = this.points.slice(0);
        // Put heighest point first
        swap(orderedPoints, 0, index);

        // Sort angles clockwise in relation to top point      
        orderedPoints.sort((a,b) => {

            const cotanA = a === top ? -Infinity : -(a.x - top.x) / (a.y - top.y);
            const cotanB = b === top ? -Infinity : -(b.x - top.x) / (b.y - top.y);

            // The smaller this number, the smaller angle it makes with top (ranges -infinity to infinity)
            return cotanA - cotanB;
        });

        // Edge case: if 2 or more points are on the same level as the top point, 
        // then the division will result in -Infinity
        // These will be at beginning of sorted array, so just get rid of the un-needed ones
        
        // First index is always our point (assuming built in sort is stable)
        for(let i = 1; i < orderedPoints.length - 1; i++){
            const point = orderedPoints[i];

            if(point.y !== top.y) break;

            const nextPoint = orderedPoints[i + 1];
    
            if(point.y === nextPoint.y){
                const indexToRemove = nextPoint.x > point.x ? i : i + 1;
                orderedPoints.splice(indexToRemove,0)
                i -= 1;
            }    
        }


        // return true if three points are clockwise 
        function clockwise(a: Vec2, b: Vec2, c: Vec2): boolean {
            return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0;
        }

        const final_points: Vec2[] = [];

        for(const point of orderedPoints){
            while(final_points.length > 1 && clockwise(final_points[final_points.length - 2], final_points[final_points.length - 1], point)){
                final_points.pop();
            }
            final_points.push(point)
        }

        return Polygon.from(final_points);
    }

    // Returns array of polygons that are triangles.
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
            polygons.push(Polygon.from([p1,p2,p3]));
        }
        return polygons;
    }

    /** Returns intersection point closest to A, or null */
    lineIntersection(A: Coordinate, B: Coordinate): { point: Vec2, normal: Vec2 } {
        
        let answer: ReturnType<Polygon["lineIntersection"]> = null;
        let answer_dist = -1;

        let k = this.points.length - 1;
        for (let i = 0; i < this.points.length; k = i++) {
            const point = this.points[k];
            const point2 = this.points[i];

            const result = Line.LineLineIntersection(A, B, point, point2);

            if(result === null) continue;

            const dist = Vec2.distanceSquared(result, A);
				
            // If no answer yet, choose this
            if(answer === null || dist < answer_dist) {
                answer_dist = dist
                answer = { 
                    point: result,
                    normal: this.normals[k]
                };
            }
        }

        return answer;
    }

    /** Returns intersection point closest to A, or null */
    lineIntersectionWithExtraInfo(A: Coordinate, B: Coordinate): { point: Vec2, normal: Vec2, line: Line } {
        
        let answer: ReturnType<Polygon["lineIntersectionWithExtraInfo"]> = null;
        let answer_dist = -1;

        let k = this.points.length - 1;
        for (let i = 0; i < this.points.length; k = i++) {
            const point = this.points[k];
            const point2 = this.points[i];

            const result = Line.LineLineIntersection(A, B, point, point2);

            if(result === null) continue;

            const dist = Vec2.distanceSquared(result, A);
				
            // If no answer yet, choose this
            if(answer === null || dist < answer_dist) {
                answer_dist = dist
                answer = { 
                    line: new Line(point, point2),
                    point: result,
                    normal: this.normals[k]
                };
            }
        }

        return answer;
    }


    /** Returns intersection points, sorted by distance to A, or empty array. SHIFT IS FOR POLYGON POINTS */
    lineIntersectionExtended(A: Coordinate, B: Coordinate, shift = Vec2.ZERO): { point: Vec2, t: number, internalT: number }[] {
        
        const answer: ReturnType<Polygon["lineIntersectionExtended"]> = [];

        let k = this.points.length - 1;
        for (let i = 0; i < this.points.length; k = i++) {
            const point = this.points[k].clone().add(shift);
            const point2 = this.points[i].clone().add(shift);

            const result = Line.LineLineIntersectionWithFirstT(A, B, point, point2);

            // Hacky way to get the t value of the self
            const flippedResult = Line.LineLineIntersectionWithFirstT(point, point2, A, B);

            if(result === null) continue;
				
            // If no answer yet, choose this

            answer.push({ 
                point: result.point,
                t: result.t,
                internalT:flippedResult.t + k,
            });
            
        }


        answer.sort( (a,b) => a.t - b.t);

        return answer;
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

    // expand(length: number): Polygon {

    //     const expandedPoints: Vec2[] = [];

    //     //let j = this.points.length - 1;
    //     for(let i = 0; i < this.points.length; i++){
    //         const A = this.points[i];
    //         const B = this.points[(i + 1) % this.points.length];
    //         const C = this.points[(i + 2) % this.points.length];

    //         const AB = Vec2.subtract(B, A);
    //         const CB = Vec2.subtract(B, C);

    //         const outward = Vec2.add(AB, CB).normalize().extend(length);

    //         outward.scale(sign((AB.x * CB.y) - (AB.y * CB.x)));

    //         expandedPoints.push(Vec2.add(B,outward));
    //     }

    //     return Polygon.from(expandedPoints);
    // }

    /** Immutable operation! Always check return type to determine what happened */
    carve_circle(x: number, y: number, r: number): CarveResult {
        
        // console.log("Polygon is clockwise : "  + Polygon.isClockwise(this.polygon.points));
        //  if this breaks, its because of an edge case with overlapping points and floating point error

        const circle = new Ellipse(new Vec2(x,y),r,r);

        // contains the points of the resulting polygon
        const newPoints: Vec2[] = [];

        // contains the indices in the newPoints array of the new collision points'
        const addedIndices: number[] = [];

        for(let i = 0; i < this.points.length; i++){
            const firstPoint =  this.points[i];
            const secondPoint = this.points[(i + 1) % this.points.length];

            // Annoying EDGE CASE:
            // Breaks sometimes if a vertex is right on the edge of the sphere. 
            // Floating math makes it so sometimes it will be detected to be contained in the sphere, but not seen in line test

            // Edge case: collisionPoint recognizes the same point over multiple calls
            // It happens when the point is tangent. I discard these
            
            const collisionPoints = Line.CircleLineIntersection(firstPoint, secondPoint, x, y, r);
            
            //*********************************************** */
            //*********************************************** */
            // INSTEAD DO firstPoint.clone()! maybe, to avoid them referencing the same point?
            //*********************************************** */
            //*********************************************** */
            if(!circle.contains(firstPoint)) newPoints.push(firstPoint);

            if(!collisionPoints.tangent){
                for(const point of collisionPoints.points){
                    newPoints.push(point);
                    addedIndices.push(newPoints.length - 1);
                    
                    // One more edge case that happens often
                    // If a vertex is on edge, might be detected 0,1, or 2 times.
                    // If 1 times, then it should try again cuz odd amount of indices
                    // If 2 times, than the added indicies will be all messed up.
                    // Because the will be on TOP of each other, and the program below assumes that they are NOT on top of each other
                    // Maybe: So if it becomes an array, check if any of the added index points are equal, and if so, call again with different r
                }  
            }
        }

        // If circle enveloped the entire polygon
        if(newPoints.length === 0){
            return { type:"total" };
            // this.polygon = null;
            // return null;
        }

        // Circle didn't even collide with lines or points
        if(addedIndices.length === 0) {
            return { type:"missed" }; 
            //return null;
        }

        // If not even number of collisions on edges, something broke due to edge case with vertex on sphere edge, 
        // try again with slightly different radius
        if(addedIndices.length % 2 !== 0){
            return this.carve_circle(x, y, r + 3)
        }

        // Sort the added indices by the points angle to the center of the sphere 
        addedIndices.sort((a,b) => {
            const p1 = newPoints[a];
            const p2 = newPoints[b];

            let p1Angle = atan2(p1.y - y, p1.x - x);
            let p2Angle = atan2(p2.y - y, p2.x - x);

            // console.log(p1Angle, p2Angle)
            return p2Angle - p1Angle;
        });

        // console.log("Indices: ", addedIndices);
        // console.log("Points: ", newPoints)

        // Algorithm 2.0: Here we go

        // Test the space between the first two points to determine the offset 
        let offset = 0;

        // Gets the point halfway between the first two points, and tests if it is in the polygon or not
        const p1 = newPoints[addedIndices[0]];
        const p2 = newPoints[addedIndices[1]];

        let startAngle = atan2(p1.y - y,p1.x - x);
        let endAngle = atan2(p2.y - y,p2.x - x);

        // This essentially just checks the angle clockwise, halfway between the two angles;
        if(startAngle < endAngle) startAngle += Math.PI * 2;

        const angleDiff = (startAngle - endAngle) / 2;
        const testAngle = startAngle - (angleDiff / 2);

        const testPoint = new Vec2(x + cos(testAngle) * r, y + sin(testAngle) * r);
        // console.log(testPoint)
        if(!this.contains(testPoint)){
            //console.log("OFFSET")
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

            if(endAngle > startAngle) endAngle -= TWO_PI;

            const circlePoints: Vec2[] = [];

            for(let i = startAngle - initialOffset; i > endAngle; i -= Math.PI * 2 / VERTICES)
                circlePoints.push(new Vec2(x + cos(i) * r, y + sin(i) * r));

            // reverse it due to the opposite ordering.
            addedCirclePointMap.set(index2, circlePoints.reverse());
        }

        //Now, we have created all the disconnected 'islands' of points (defined in islands array), we just need to make them seperate polygon objects
        // And add the points from the circle

        // console.log(freeIslandNumber)
        // console.log("Islands: " + islands)

        const components: Vec2[][] = [];

        // Each free number creates either nothing, or it creates an entire 
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


        // ONE MORE EDGE CASE CHECK MAYBE:
        // In some floating point math error cases, I will get polygon's that are just two points on top of each other
   
        const returnMeshes: Polygon[] = [];

        for(let i = 0; i < components.length; i++){
            returnMeshes.push(Polygon.from(components[i]));
        }
        
        return { type:"normal", parts:returnMeshes };    
    }

    /** Immutable operation! Always check return type to determine what happened */
    carve_polygon(shape: Polygon, shift: Vec2): CarveResult {
        // Every point in 'shape' is translated by 'shift' 

        //  if this breaks, its because of an edge case with overlapping points and floating point error
        // contains the points of the resulting polygon
        const newPoints: Vec2[] = [];

        // contains the indices in the newPoints array of the new collision points'
        const addedIndices: {indexInArray: number, orderInShape:number }[] = [];

        for(let i = 0; i < this.points.length; i++){
            const firstPoint =  this.points[i];
            const secondPoint = this.points[(i + 1) % this.points.length];

            if(!shape.contains(firstPoint.clone().sub(shift))) newPoints.push(firstPoint);

            const collisions = shape.lineIntersectionExtended(firstPoint, secondPoint,shift);

            for(const c of collisions){
                newPoints.push(c.point);

                addedIndices.push({ 
                    indexInArray: newPoints.length - 1,
                    orderInShape: c.internalT
                });
            }
        }

        // If circle enveloped the entire polygon
        if(newPoints.length === 0){
            return { type:"total" };
        }

        // Circle didn't even collide with lines or points
        if(addedIndices.length === 0) {
            return { type:"missed" };
        }

        // If not even number of collisions on edges, something broke due to edge case with vertex on sphere edge, 
        // try again with different position
        if(addedIndices.length % 2 !== 0){
            return this.carve_polygon(shape, shift.clone().add({x:3, y:4}))
        }

        // Sort the added indices by the points angle to the center of the sphere 
        addedIndices.sort((a,b) => a.orderInShape - b.orderInShape);

        // console.log("Indices: ", addedIndices);
        // console.log("Points: ", newPoints)

        // Algorithm 2.0: Here we go

        // Test the space between the first two points to determine the offset 
        let offset = 0;

        // Gets the point halfway between the first two points, and tests if it is in the polygon or not
        let p1 = addedIndices[0].orderInShape;
        let p2 = addedIndices[1].orderInShape;

        // floating point number
        const indexToCheck = (p1 + p2) / 2;

        const t = indexToCheck % 1;
        const finalIndexToCheck = floor(indexToCheck);

        // Modulo might not be needed here.
        const testPoint = mix(shape.points[finalIndexToCheck % shape.points.length],shape.points[(finalIndexToCheck + 1) % shape.points.length],t);
        testPoint.add(shift);

        if(!this.contains(testPoint)){
            // console.log("OFFSET")
            offset = 1;
        }


        // parralel array of connected components
        const islands: number[] = [];
        islands.length = newPoints.length;
        islands.fill(0);

        let freeIslandNumber = 0;

        // Key is the index where we add the points
        const addedPointMap: Map<number,Vec2[]> = new Map();
        
        // Cycles through points and creates ALL the disconnected components
        for(let i = 0; i < addedIndices.length; i += 2){
            const ii = (i + offset) % addedIndices.length;
            const ii2 = (ii + 1) % addedIndices.length;

            // Index inside of the newPoints array denoting the beginning and end of where points should be filled in
            // Move clockwise (right) from index until get to index2. Will wrap around array at times.
            
            const a = addedIndices[ii].indexInArray;
            const b = addedIndices[ii2].indexInArray;

            freeIslandNumber += 1;

            // this and islands[index2] should always be equal
            const islandNumber = islands[a];

            let j = a;
            while(j !== b){
                // Essentially, if this point doesn't belong to another group already
                if(islands[j] === islandNumber){
                    islands[j] = freeIslandNumber;
                }

                j = (j + 1) % newPoints.length;
            }

            // Add b as well. j == b here
            islands[j] = freeIslandNumber;

           
            
            // ADDING POLYGON POINTS
            const shapeIndexA = addedIndices[ii].orderInShape;
            let shapeIndexB =  addedIndices[ii2].orderInShape;

            if(shapeIndexB < shapeIndexA) shapeIndexB += shape.points.length;

            const pointsToAdd: Vec2[] = [];
 
            let k = shapeIndexA;
            while(k < floor(shapeIndexB)){

                const indexOfAddingPoint = ceil(k) % shape.points.length;

                pointsToAdd.push(shape.points[indexOfAddingPoint].clone().add(shift));

                k += 1;
            }

            // reverse it due to the opposite ordering.
            addedPointMap.set(b, pointsToAdd.reverse());
        }

        //Now, we have created all the disconnected 'islands' of points (defined in islands array), we just need to make them seperate polygon objects
        // And add the points from the circle

        // console.log("Islands: " + islands)

        const components: Vec2[][] = [];

        // Each free number creates either nothing, or it creates an entire 
        for(let i = 0; i <= freeIslandNumber; i++){

            const points: Vec2[] = [];

            for(let j = 0; j < newPoints.length; j++){
                // remember, newPoints and island are parralel arrays
                if(islands[j] === i){
                    points.push(newPoints[j]);

                    const possibleAddedPoints = addedPointMap.get(j);
                    if(possibleAddedPoints !== undefined){
                        points.push(...possibleAddedPoints);
                    }
                }
            }

            if(points.length !== 0) components.push(points);
        }

        const returnMeshes: Polygon[] = [];

        for(let i = 0; i < components.length; i++){
            returnMeshes.push(Polygon.from(components[i]));
        }

        return { type:"normal", parts:returnMeshes };
    }


    toPolygon(): Polygon {
        return this.clone();
    }
    
    draw(g: Graphics, color: number = niceColor(), normals = true, fill = true, points = true): void {
        g.lineStyle(3,color,.9);
        g.endFill();

        if(fill) g.beginFill(color);

        g.drawPolygon(this.points as unknown as Point[])

        if(fill) g.endFill()

        // draw points
        // Drawing a lot of these is actually quiet slow. 
        if(points){
            for(const point of this.points){
                drawPoint(g, point)
            }
        }
  

        // Draw normals
        if(normals){
            for(let i = 0; i < this.normals.length; i++){
                let j = i + 1;
                if(j == this.points.length) j = 0;
                const p1 = this.points[i];
                const p2 = this.points[j]
                
                const half_way = mix(p1, p2, .5);
                const distance = Vec2.distance(p1, p2);

                drawVecAsArrow(g,this.normals[i], half_way.x, half_way.y, min(50,distance));
            }
        }
    }
}



/** Top left AABB
 *  Takes in array of coordinates, returns a coordinate with the min x and min y of all points
 */
export function minPoint(array: readonly Coordinate[]): Coordinate{
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
export function maxPoint(array: readonly Coordinate[]): Coordinate{
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


