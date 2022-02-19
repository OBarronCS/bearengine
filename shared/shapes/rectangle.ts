import { Coordinate, distanceSquared, Vec2 } from "./vec2";
import { Shape } from "./shapesinterfaces";
import { Polygon, minPoint, maxPoint } from "./polygon";
import { min, max, clamp } from "shared/misc/mathutils";
import { lines_intersect } from "./line";
import type { Graphics } from "shared/graphics/graphics";

export interface Dimension {
    width: number;
    height: number;
}

export function dimensions(w: number, h: number): Dimension {
    return {width: w, height: h};
}

export class Rect implements Shape<Rect> {

    x: number;
    y: number;
    x2: number;
    y2: number;

    static from_points(...points: Coordinate[]): Rect {
        const topLeft = minPoint(points);
        const botRight = maxPoint(points);

        return new Rect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);
    }

    static from_corners(x1: number, y1: number, x2: number, y2: number): Rect {
        return new Rect(x1, y1, x2 - x1, y2 - y1);
    }
    
    static rectContains(x: number, y: number, width: number, height: number, point: Coordinate): boolean {
        return (point.x > x
            && point.x < x + width
            && point.y > y
            && point.y < y + height);
    }

    get left() { return this.x; }
    get right() { return this.x2; }
    get top() { return this.y; }
    get bot() { return this.y2; }

    set left(x: number) { this.x = x; }
    set right(x: number) { this.x2 = x; }
    set top(y: number) { this.y = y; }
    set bot(y: number) { this.y2 = y; }

    get width() {return this.x2 - this.x; }
    get height() { return this.y2 - this.y; }

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.x2 = x + width;
        this.y2 = y + height;
    }

    setDimensions(width: number, height: number){
        this.x2 += this.x + width;
        this.y2 += this.y + height;
    }

    copyFrom(rect: Rect): this {
        this.x = rect.x;
        this.y = rect.y;
        this.x2 = rect.x2;
        this.y2 = rect.y2;

        return this;
    }

    getAABB() {
        return this.clone();
    }

    //* Returns the rectangle of intersection, otherwise null */
    intersection(rect: Rect): Rect {
        const left = max(this.x, rect.x);
        const right = min(this.right, rect.right);
        if (right <= left){
            return null;
        } else {
            const top = max(this.y, rect.y);
            const bot = min(this.bot, rect.bot);
            if (bot <= top){
                return null;
            } else {
                return new Rect(left, top, right - left, bot-top);
            }
        }
    }

    intersects(rect: Rect): boolean {
        if(this.left >= rect.right || rect.left >= this.right){
            return false;
        } 

        if(this.top >= rect.bot || rect.top >= this.bot){
            return false;
        } 

        return true;
    }

    /** Contains but for rectangles --> I wishes TypeScript had method overloading */
    encloses(rect: Rect): boolean {
        return (this.left <= rect.left 
            && this.top <= rect.top
            && this.right >= rect.right
            && this.bot >= rect.bot);
    }

    // Points on edge not included right now
    contains(point: Coordinate): boolean {
        return (point.x > this.left
            && point.x < this.right
            && point.y > this.top
            && point.y < this.bot);
    }

    copyTo(rect: Rect) {
        return rect.copyFrom(this)
    }

    clone() {
        return new Rect(this.x, this.y, this.x2 - this.x, this.y2 - this.y);
    }

    draw(g: Graphics, color = 0x0000FF, width = 4, alpha = 1): void {
        g.endFill();
        g.lineStyle(width, color, alpha);
        g.drawRect(this.x, this.y, this.x2 - this.x, this.y2 - this.y);
    }

    /** Returns a rectangle that encloses both of these */
    // Union is same thing
    merge(box: Rect): Rect {
        // Top left
        const _x = min(this.x, box.x);
        const _y = min(this.y, box.y);

        // Bot right
        const _x2 = max(this.right, box.right);
        const _y2 = max(this.bot, box.bot);

        return new Rect(_x, _y, _x2 - _x, _y2 - _y);
    }

    /** Returns a clockwise polygon */
    toPolygon(): Polygon {
        const points: Vec2[] = [];
        points.push(new Vec2(this.left, this.top));
        points.push(new Vec2(this.left, this.bot));
        points.push(new Vec2(this.right, this.bot));
        points.push(new Vec2(this.right, this.top));

        const normals: Vec2[] = [];
        normals.push(new Vec2(-1, 0));
        normals.push(new Vec2(0, 1)); 
        normals.push(new Vec2(1, 0));
        normals.push(new Vec2(0, -1));

        return new Polygon(points, normals);
    }
    
    // Keeps the dimensions, moves the top left to these points
    moveTo(point: Coordinate){
        const w = this.width;
        const h = this.height;
        this.x = point.x;
        this.y = point.y;

        this.x2 = this.x + w;
        this.y2 = this.y + h;
    }

    translate(point: Coordinate): this {
        this.x += point.x;
        this.y += point.y;

        this.x2 += point.x;
        this.y2 += point.y;
        return this;
    }


    area(): number {
        return this.height * this.width;
    }

    center(): Vec2 {
        return new Vec2(this.x + this.width / 2, this.y + this.height / 2);
    }

    // Maybe find a better spot to put this
    static CollidesWithSphere(rect: Rect, x: number, y: number, r: number): boolean {
        if(rect.contains({x: x, y: y})) return true;
        // Check if the closest point to this rect is at least r away from the sphere
        const _x = clamp(x, rect.left, rect.right);
        const _y = clamp(y, rect.top, rect.bot);
        if(distanceSquared(_x,_y,x,y) <= r * r) return true;

        return false;
    }

    static CollidesWithLine(rect: Rect, x1: number, y1: number, x2: number, y2: number): boolean {
        // Turn the rect into 4 lines, check line-line intersections
        
        // Vertical
        if(lines_intersect(rect.left, rect.top, rect.left, rect.bot, x1,y1,x2,y2, true) > 0) return true;
        if(lines_intersect(rect.right, rect.top, rect.right, rect.bot, x1,y1,x2,y2, true) > 0) return true;

        // Horizontal
        if(lines_intersect(rect.left, rect.top, rect.right, rect.top, x1,y1,x2,y2, true) > 0) return true;
        if(lines_intersect(rect.left, rect.bot, rect.right, rect.bot, x1,y1,x2,y2, true) > 0) return true;

        return false;
    }

}


