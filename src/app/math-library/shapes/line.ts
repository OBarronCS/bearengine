import { Vec2, Coordinate } from "./vec2";
import { Rect } from "./rectangle";
import { Graphics } from "pixi.js";
import { drawLineBetweenPoints } from "./shapedrawing";


// A line segment
export class Line {

    A: Vec2;
    B: Vec2;
    normal: Vec2;

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

    /**
     * null if no intersection, point of intersection otherwise
     * @param line 
     */    
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


