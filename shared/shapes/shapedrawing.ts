import type { Graphics } from "pixi.js";
import { string2hex } from "shared/miscmath";
import { Coordinate } from "./vec2";

// draws the vector as an arrow taking into account magnitude and direction, at a certain location
export function drawVecAsArrow(graphics: Graphics, vec: Coordinate, _x: number, _y: number, lengthMultiplier: number){
	const width = 2;
	const color = "#00FF00";
    
    graphics.lineStyle(width, string2hex(color));
    graphics.moveTo(_x,_y);
    graphics.lineTo(_x + (vec.x * lengthMultiplier),  _y + (vec.y * lengthMultiplier));
}

export function drawPoint(graphics: Graphics, point: Coordinate, color: string = "#00FFF0"){
    graphics.beginFill(string2hex(color));
    graphics.drawCircle(point.x, point.y, 4);
}

export function drawCircle(graphics: Graphics, point: Coordinate, r: number, color: string = "#00FFF0", alpha = 1){
    graphics.beginFill(string2hex(color), alpha);
    graphics.drawCircle(point.x, point.y, r);
}

export function drawLineArray(g: Graphics, points: Coordinate[], color: number, loop = false){
    g.lineStyle(3,color)
    for (let i = 0; i < points.length - 1; ++i) {
        const p1 = points[i];
        const p2 = points[i + 1];
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
    }

    if(loop){
        const p1 = points[0];
        const p2 = points[points.length - 1];

        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
    }
}

export function drawLineBetweenPoints(graphics: Graphics, point1: Coordinate, point2: Coordinate, color: string = "#FF000F", alpha = 1, width = 3){
    const real_color = string2hex(color);
    
	const x1 = point1.x;
	const y1 = point1.y;
	const x2 = point2.x;
	const y2 = point2.y;
    
    graphics.lineStyle(width, real_color, alpha);
    graphics.moveTo(x1,y1);
    graphics.lineTo(x2,y2);

    // resets
    graphics.moveTo(0,0);
}

