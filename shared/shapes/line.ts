import { Vec2, Coordinate, mix } from "./vec2";
import { Rect } from "./rectangle";
import type { Graphics } from "pixi.js";
import { abs, clamp, sqrt } from "../miscmath";
import { drawLineBetweenPoints } from "shared/shapes/shapedrawing";
import { Ellipse } from "./ellipse";
import { CircularLinkedList } from "shared/datastructures/linkedlist";


// A line segment
export class Line {

    A: Vec2;
    B: Vec2;
    normal: Vec2;

    // Returns a normal of two points, it can be either of the two options depending on which is a or b.
    static normal(a: Coordinate,b: Coordinate): Vec2 {
        const dx = a.x - b.x;
        const dy = a.y - b.y;

        const magnitude = Math.sqrt((dx * dx) + (dy * dy));

        return new Vec2(dy/magnitude, -dx/magnitude);
    }

    static PointClosestToLine(A:Coordinate, B:Coordinate, p: Coordinate): Vec2 {
        //How it works:
        // Finds the point on the line that when passed through p, is normal to the line.
        //http://paulbourke.net/geometry/pointlineplane/ 

        // if points lay on top of each other, there's a divide by zero so just return the point itself
        if(A.x === B.x && A.y === B.y) {
            return new Vec2(A.x, A.y);
        }

        const dx = B.x - A.x;
        const dy = B.y - A.y;

        const numerator = (p.x - A.x)*(dx) +  (p.y - A.y)*(dy)
        const denominator = Vec2.distanceSquared(B, A);
        const u = clamp(numerator / denominator,0,1);

        return new Vec2(A.x + u * dx, A.y + u * dy);
    }

    /** DOES NOT RETURN tangential points! */
    static CircleLineIntersection(p1: Coordinate,p2: Coordinate, x: number, y: number, r: number, infiniteLine = false): {tangent: boolean, points: Vec2[]}{
        //http://paulbourke.net/geometry/circlesphere/

        // One more edge case not dealt with: if points on top of eachother. Causes a divide by zero that fails silently
        // return true in this case only if perfeclty on edge of circle

        const a = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
        const b = 2*( ((p2.x - p1.x)*(p1.x - x)) + ((p2.y - p1.y)*(p1.y - y)) )
        const c = x**2 + y**2 + p1.x**2 + p1.y**2 - 2*((x * p1.x) + y*p1.y) - r**2;

        // Quadtratic equation
        const h = (b**2) - (4*a*c);
        if(h < 0) return { tangent: false, points: [] } ;

        // Im pretty sure this returns the points in order from p1 to p2
        // Maybe do explicit test, first smallest one first
        const u1 = (-b - sqrt(h))/(2*a);
        const u2 = (-b + sqrt(h))/(2*a);
        
        if(infiniteLine){
            throw new Error("This might be tangent, code in the case later");
            return {tangent: false, points:[mix(p1,p2, u1), mix(p1,p2, u2)]} ;
        }
        else {
            // This case means the line is tangential 
            if(u1 === u2 && u1 >= 0 && u1 <= 1 && u2 >= 0 && u2 <= 1){
                return {tangent: true, points: [mix(p1,p2, abs(u1))]};
            }

            const points = [];
            const point1 = (u1 >= 0 && u1 <= 1) ? mix(p1,p2, u1) : null;
            const point2 = (u2 >= 0 && u2 <= 1) ? mix(p1,p2, u2) : null;
            if(point1 !== null) points.push(point1);
            if(point2 !== null) points.push(point2);
            return {tangent: false, points: points};
    
        }   
    }

    static LineLineIntersection(A: Coordinate, B: Coordinate, A2: Coordinate, B2: Coordinate): Vec2 | null {
        const t = lines_intersect(A.x, A.y, B.x, B.y, A2.x, A2.y, B2.x, B2.y, true);
        if(t > 0){
            const x = A.x + t * (B.x - A.x);
            const y = A.y + t * (B.y - A.y);
            return new Vec2(x, y);
        }

        return null;

    }

    constructor(p1: Coordinate, p2: Coordinate, normal: Coordinate = {x: 0, y: -1}){
        this.A = new Vec2(p1.x, p1.y);
        this.B = new Vec2(p2.x, p2.y);
        this.normal = new Vec2(normal.x, normal.y);;
    }

    getAABB(){
        const left = Math.min(this.A.x, this.B.x);
		const right = Math.max(this.A.x, this.B.x);
		const top = Math.min(this.A.y, this.B.y);
		const bot = Math.max(this.A.y, this.B.y);
        
        const rect = new Rect(left, top, right - left, bot - top);
		return rect;
    }


    pointClosestTo(p: Coordinate): Vec2 {
        return Line.PointClosestToLine(this.A, this.B, p)
    }

    /** null if no intersection, point of intersection otherwise */    
    intersects(line: Line): Vec2 {
        const t = lines_intersect(this.A.x, this.A.y, this.B.x, this.B.y, line.A.x, line.A.y, line.B.x, line.B.y, true);
        if(t > 0){
            const _x = this.A.x + t * (this.B.x - this.A.x)
            const _y = this.A.y + t * (this.B.y - this.A.y)
            return new Vec2(_x, _y);
        }

        return null;
    }

    draw(g: Graphics, color?: string){
        drawLineBetweenPoints(g, this.A, this.B, color);
    }

}

export function lines_intersect(argument0:number,argument1: number,argument2: number,argument3:number,argument4:number,argument5:number,argument6:number,argument7:number,argument8: boolean): number{
	/// https://www.gmlscripts.com/script/lines_intersect
	/// lines_intersect(x1,y1,x2,y2,x3,y3,x4,y4,segment)
	//
	//  Returns a vector multiplier (t) for an intersection on the
	//  first line. A value of (0 < t <= 1) indicates an intersection 
	//  within the line segment, a value of 0 indicates no intersection, 
	//  other values indicate an intersection beyond the endpoints.
	//
	//      x1,y1,x2,y2     1st line segment
	//      x3,y3,x4,y4     2nd line segment
	//      segment         If true, confine the test to the line segments.
	//
	//  By substituting the return value (t) into the parametric form
	//  of the first line, the point of intersection can be determined.
	//  eg. x = x1 + t * (x2 - x1)
	//      y = y1 + t * (y2 - y1)
	//
	/// GMLscripts.com/license
    let ua, ub, ud, ux, uy, vx, vy, wx, wy;
    ua = 0;
    ux = argument2 - argument0;
    uy = argument3 - argument1;
    vx = argument6 - argument4;
    vy = argument7 - argument5;
    wx = argument0 - argument4;
    wy = argument1 - argument5;
    ud = vy * ux - vx * uy;
    if (ud != 0) 
    {
        ua = (vx * wy - vy * wx) / ud;
        if (argument8) 
        {
            ub = (ux * wy - uy * wx) / ud;
            if (ua < 0 || ua > 1 || ub < 0 || ub > 1) ua = 0;
        }
    }
    return ua;
}
/*
Copyright (c) 2007-2020, GMLscripts.com

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.

  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.

  3. This notice may not be removed or altered from any source distribution.

GMLscripts.com/license
*/


