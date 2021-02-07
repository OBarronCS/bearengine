
import { DEG_TO_RAD, RAD_TO_DEG, dcos, dsin, floor } from "shared/miscmath";

export interface Coordinate {
    x: number,
    y: number
}

export class Vec2 {
    
    public x: number
    public y: number

    // Maybe make these getters so you can take a mutable one, instead of having to call .clone()
    static ZERO: Readonly<Coordinate> = new Vec2(0,0);

    // Direction relative to screen, so all Y values are flipped
    static RIGHT: Readonly<Coordinate> = new Vec2(1,0);
    static LEFT: Readonly<Coordinate> = new Vec2(-1,0);
    static UP: Readonly<Coordinate> = new Vec2(0,-1);
    static DOWN: Readonly<Coordinate> = new Vec2(0,1);
    static SE: Readonly<Coordinate> = new Vec2(Math.SQRT1_2,Math.SQRT1_2);
    static SW: Readonly<Coordinate> = new Vec2(-Math.SQRT1_2,Math.SQRT1_2);
    static NE: Readonly<Coordinate> = new Vec2(Math.SQRT1_2,-Math.SQRT1_2);
    static NW: Readonly<Coordinate> = new Vec2(-Math.SQRT1_2,-Math.SQRT1_2);
    static HALFHALF: Readonly<Coordinate> = new Vec2(0.5,0.5);

    /** A random vector of a given length */
    static random(length = 1): Vec2 {
        const vec = new Vec2(0,0);
        const angle = Math.random() * 360;
        vec.x = dcos(angle) * length;
        vec.y = dsin(angle) * length;
        
        return vec;
    }

    static distanceSquared(p1: Coordinate, p2: Coordinate): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return (dx * dx) + (dy * dy);
    }

    static distance(p1: Coordinate, p2: Coordinate): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /** Does not alter the first two parameters. Stores result in target, which is a new vector by default */
    static add(vec1: Readonly<Coordinate>, vec2: Readonly<Coordinate>, target: Vec2 = new Vec2(0,0)){
        target.x = vec1.x + vec2.x;
        target.y = vec1.y + vec2.y;
        return target;
    }

    /** Does not alter the first two parameters. Stores result in target, which is a new vector by default */
    static subtract(vec1: Readonly<Coordinate>, vec2: Readonly<Coordinate>, target: Vec2 = new Vec2(0,0)){
        target.x = vec1.x - vec2.x;
        target.y = vec1.y - vec2.y;
        return target;
    }

    static dot(vec1: Coordinate, vec2: Coordinate): number {
        return (vec1.x * vec2.x) + (vec1.y * vec2.y);
    }

    static bounce(vec: Coordinate, normal: Coordinate, target: Vec2 = new Vec2(0,0)): Vec2 {
        const dot = 2 * Vec2.dot(vec,normal);
        target.x = vec.x - dot * normal.x;
        target.y = vec.y - dot * normal.y;
        return target;
    }


    
    constructor(_x: number,_y: number){
        this.x = _x;
        this.y = _y;
    }

    public dot(vec: Coordinate): number {
        return (this.x * vec.x) + (this.y * vec.y);
    }

    public scale(multiply: number): this {
        this.x *= multiply;
        this.y *= multiply;
        return this;
    }

    public set(point: Coordinate): this {
        this.x = point.x;
        this.y = point.y;
        return this;
    }

    public negate(): this {
        this.x = -this.x;
        this.y = -this.y
        return this;
    }

    public add(point: Coordinate): this {
        this.x += point.x;
        this.y += point.y;
        return this;
    }

    public sub(point: Coordinate): this {
        this.x -= point.x;
        this.y -= point.y;
        return this;
    }

    /** returns distance between these two points */
    public distance(point: Coordinate): number {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    public length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    public lengthSquared(): number {
        return this.x * this.x + this.y * this.y
    }

    /** Radians */
    public angle(): number {
		return Math.atan2(this.y, this.x);
    }
    
    /** Degrees */
    public dangle(): number {
		return Math.atan2(this.y, this.x) * RAD_TO_DEG;
	}

    public setDirection(radians: number): this {
        const length = this.length();

		this.x = length * Math.cos(radians);
		this.y = length * Math.sin(radians);

		return this;
	}
    
    /** radians */
    public rotate(radians: number): this {
		const old_x = this.x;
		this.x = this.x * Math.cos(radians) - this.y * Math.sin(radians);
        this.y = old_x * Math.sin(radians) + this.y * Math.cos(radians);
        return this;
    }

    /**
     * Rotate vector in degrees
     * @param degrees 
     */
    public drotate(degrees: number): this {
        return this.rotate(degrees * DEG_TO_RAD);
    }
    
    public floor(): this {
        this.x = floor(this.x);
        this.y = floor(this.y);
        return this;
    }
 
    public normalize(): this {
        const len = this.length();
		// Don't want to divide by zero!
	    if (len > 0) {
	        this.x /= len;
	        this.y /= len;
        }
        return this
    }

    /** Set the length of the vector
     *  TODO: change this to a more intuitive name 
     */
    public extend(magnitude: number): this {
		this.normalize();
		this.x *= magnitude;
		this.y *= magnitude;
		return this;
    }
    
    /** Takes in a NORMALIZED VECTOR, and converts this vector to that bounced vector */
    public bounce(normal: Coordinate): this {
        Vec2.bounce(this, normal, this);
        return this;
    }

    clone(){
        return new Vec2(this.x, this.y);
    }

    toArray(): [number, number]{
        return [this.x, this.y];
    }

    toString(){
        return this.x + "," + this.y
    }
}

export function angleBetween(p1: Coordinate, p2: Coordinate){
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/** [x1, y1, x2, y2] -> [vec1, vec2] */
export function coordinateArraytoVec(array: number[]): Vec2[] {
    const vecs: Vec2[] = []
    for(let i = 0; i < array.length; i += 2){
        vecs.push(new Vec2(array[i], array[i + 1]));
    }
    return vecs;
}

/** [vec1, vec2] --> [vec1.x, vec1.y, vec2.x, vec2.y] */
export function flattenVecArray(array: Coordinate[]){
    return array.flatMap(vec => [vec.x, vec.y]);
}

export function rotatePoint(_point: Vec2, _center: Coordinate, _unit_circle: Coordinate){
    const rotatedX = -_unit_circle.y * (_point.x - _center.x) - _unit_circle.x * (_point.y-_center.y) + _center.x;
    const rotatedY = _unit_circle.x * (_point.x - _center.x) + -_unit_circle.y * (_point.y-_center.y) + _center.y;
	
	_point.set({x: rotatedX, y: rotatedY});
}

export function mix(A: Coordinate, B: Coordinate, percent: number, target: Vec2 = new Vec2(0,0)){
	const _x = A.x * (1 - percent) + B.x * percent;
    const _y = A.y * (1 - percent) + B.y * percent;
    target.set({x: _x, y: _y});
	return target
}

export function distanceSquared(x1: number, y1: number, x2: number, y2: number){
	return ((x2 - x1) * (x2 - x1)) + ((y2 - y1) * (y2 - y1))
}

