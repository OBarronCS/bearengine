import { Coordinate, Vec2 } from "../vec2";
import { Shape } from "./shapesinterfaces";
import { Polygon, minPoint, maxPoint } from "./polygon";
import { min, max } from "../miscmath";



export class Rect implements Shape<Rect> {

    x: number;
    y: number;
    x2: number;
    y2: number;

    static fromPoints(...points: Coordinate[]): Rect{
        const topLeft = minPoint(points);
        const botRight = maxPoint(points);

        return new Rect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);
    }
    
    get left() { return this.x; }
    get right() { return this.x2; }
    get top() { return this.y; }
    get bot() { return this.y2; }
    
    get width() {return this.x2 - this.x; }
    get height() { return this.y2 - this.y; }

    set left(x: number) { this.x = x; }
    set right(x: number) { this.x2 = x; }
    set top(y: number) { this.y = y; }
    set bot(y: number) { this.y2 = y; }

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.x2 = x + width;
        this.y2 = y + height;
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

    draw(g: PIXI.Graphics, color = 0x0000FF, width = 4): void {
        g.endFill();
        g.lineStyle(width, color);
        g.drawRect(this.x, this.y, this.x2 - this.x, this.y2 - this.y);
    }

    /** Returns a rectangle that encloses both of these */
    merge(box: Rect): Rect {
        // Top left
        const _x = min(this.x, box.x);
        const _y = min(this.y, box.y);

        // Bot right
        const _x2 = max(this.right, box.right);
        const _y2 = max(this.bot, box.bot);

        return new Rect(_x, _y, _x2 - _x, _y2 - _y);
    }

    toPolygon(): Polygon {
        const points: Vec2[] = [];
        points.push(new Vec2(this.left, this.top));
        points.push(new Vec2(this.right, this.top));
        points.push(new Vec2(this.right, this.bot));
        points.push(new Vec2(this.left, this.bot));

        const normals: Vec2[] = [];
        normals.push(new Vec2(0, -1));
        normals.push(new Vec2(1, 0));
        normals.push(new Vec2(0, 1));
        normals.push(new Vec2(-1, 0));

        return new Polygon(points, normals);
    }
}


