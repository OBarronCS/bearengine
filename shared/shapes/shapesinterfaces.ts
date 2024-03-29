import { Coordinate } from "./vec2";
import { Rect } from "./rectangle";
import type { Graphics } from "shared/graphics/graphics";
import { Polygon } from "./polygon";


export interface Shape<T> {
    clone(): T,
    contains(point: Coordinate): boolean,
    copyFrom(shape: T): this,
    
    // maybe get rid of the following since the return value isn't really intuitive
    copyTo(shape: T): T,
    getAABB(): Rect,
    draw(g: Graphics, color?: number): void;
    toPolygon(): Polygon;
}

/* MAYBE: 
equals()
*/
