import type { Graphics } from "shared/graphics/graphics";
import { Coordinate } from "./vec2";

export function drawProgressBar(g: Graphics, x1: number, y1: number, width: number, height: number, percent: number, alpha = 1){
    g.beginFill(0x000000, alpha);
    g.drawRect(x1, y1, width, height);
    g.beginFill(0xFF0000, alpha);
    g.drawRect(x1, y1, width * percent, height);
    g.endFill();
}

// draws the vector as an arrow taking into account magnitude and direction, at a certain location
export function drawVecAsArrow(graphics: Graphics, vec: Coordinate, _x: number, _y: number, lengthMultiplier: number){
	const width = 2;
	const color = 0x00FF00;
    
    graphics.lineStyle(width, color);
    graphics.moveTo(_x,_y);
    graphics.lineTo(_x + (vec.x * lengthMultiplier),  _y + (vec.y * lengthMultiplier));
}

export function drawPoint(g: Graphics, point: Coordinate, color = 0x00FFF0){
    g.beginFill(color);
    g.drawRect(point.x - 2, point.y - 2, 4, 4);
    g.endFill();
}

export function drawCircleOutline(g: Graphics, point: Coordinate, r: number, color = 0x00FFF0, alpha = 1){
    // g.beginFill(color, alpha);
    g.lineStyle(2,color,alpha)
    g.drawCircle(point.x, point.y, r);
    g.endFill();
}

export function drawCircle(g: Graphics, point: Coordinate, r: number, color = 0x00FFF0, alpha = 1){
    g.beginFill(color, alpha);
    g.drawCircle(point.x, point.y, r);
    g.endFill();
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

export function drawLineBetweenPoints(graphics: Graphics, point1: Coordinate, point2: Coordinate, color = 0xFF000F, alpha = 1, width = 3){
    const real_color = color;
    
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

