import { Graphics, utils } from "pixi.js";
import { Coordinate } from "../vec2";

// draws the vector as an arrow taking into account magnitude and direction, at a certain location
export function drawVecAsArrow(graphics: Graphics, vec: Coordinate, _x: number, _y: number, _factor: number){
	const width = 2;
	const color = "#00FF00";
    
    graphics.lineStyle(width, utils.string2hex(color));
    graphics.moveTo(_x,_y);
    graphics.lineTo(_x + (vec.x * _factor),  _y + (vec.y * _factor));
}

/// @func drawPoint(vec2, [color])
export function drawPoint(graphics: Graphics, point: Coordinate, color: string = "#00FFF0"){
    graphics.beginFill(utils.string2hex(color));
    graphics.drawCircle(point.x, point.y, 4);
}

/// @func drawLineBetweenPoints(point1, point2, [color])
export function drawLineBetweenPoints(graphics: Graphics, point1: Coordinate, point2: Coordinate){
    const width = 3;
    const color = utils.string2hex("#FF000F");
    
	const x1 = point1.x;
	const y1 = point1.y;
	const x2 = point2.x;
	const y2 = point2.y;
    
    graphics.lineStyle(width, color);
    graphics.moveTo(x1,y1);
    graphics.lineTo(x2,y2);

    // resets
    graphics.moveTo(0,0);
}

