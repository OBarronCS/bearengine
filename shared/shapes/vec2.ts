
import { DEG_TO_RAD, RAD_TO_DEG, dcos, dsin, floor, min, max } from "shared/misc/mathutils";
import { random } from "shared/misc/random";
import { Rect } from "./rectangle";

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

    static from(c: Coordinate){
        return new Vec2(c.x,c.y);
    }

    /** Returns unit vector, n degrees from positive x-axis */
    static from_dangle(degrees: number): Vec2 {
        const x = dcos(degrees);
        const y = dsin(degrees);

        return new Vec2(x,y);
    }

    /** A random vector of a given length */
    static random(length = 1): Vec2 {
        const vec = new Vec2(0,0);
        const angle = Math.random() * 360;
        vec.x = dcos(angle) * length;
        vec.y = dsin(angle) * length;
        
        return vec;
    }

    /** A random vector of with random length up to max*/
    static random_max_length(max_length = 1): Vec2 {
        return Vec2.random(random(max_length))
    }

    static distanceSquared(p1: Coordinate, p2: Coordinate): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return (dx * dx) + (dy * dy);
    }

    static AABB(p1: Coordinate, p2: Coordinate){
        const left = min(p1.x, p2.x);
        const right = max(p1.x, p2.x);

        const top = min(p1.y, p2.y);
        const bot = max(p1.y, p2.y);

        return new Rect(left, top, right - left, bot - top);
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

    /** Mutates targets. Assumes both are normalized */
    static bounce(vec: Coordinate, normal: Coordinate, target: Vec2 = new Vec2(0,0)): Vec2 {
        const dot = 2 * Vec2.dot(vec,normal);
        target.x = vec.x - dot * normal.x;
        target.y = vec.y - dot * normal.y;
        return target;
    }


    /** Zero by default. y = x if only first argument provided */
    constructor(x: number = 0, y: number = x){
        this.x = x;
        this.y = y;
    }

    dot(vec: Coordinate): number {
        return (this.x * vec.x) + (this.y * vec.y);
    }

    scale(multiply: number): this {
        this.x *= multiply;
        this.y *= multiply;
        return this;
    }

    set(point: Coordinate): this {
        this.x = point.x;
        this.y = point.y;
        return this;
    }

    setX(x: number): this {
        this.x = x;
        return this;
    }

    setY(y: number): this {
        this.y = y;
        return this;
    }

    setXY(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    negate(): this {
        this.x = -this.x;
        this.y = -this.y
        return this;
    }
    
    /** Inplace add */
    add(point: Coordinate): this {
        this.x += point.x;
        this.y += point.y;
        return this;
    }

    sub(point: Coordinate): this {
        this.x -= point.x;
        this.y -= point.y;
        return this;
    }

    /** returns distance between these two points */
    distance(point: Coordinate): number {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceSquared(point: Coordinate): number {
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        return dx * dx + dy * dy;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    lengthSquared(): number {
        return this.x * this.x + this.y * this.y
    }

    /** Radians */
    angle(): number {
		return Math.atan2(this.y, this.x);
    }
    
    /** Degrees */
    dangle(): number {
		return Math.atan2(this.y, this.x) * RAD_TO_DEG;
	}

    setDirection(radians: number): this {
        const length = this.length();

        if(length === 0){
            throw new Error("Attempting to set direction of zero vector");
        }

		this.x = length * Math.cos(radians);
		this.y = length * Math.sin(radians);

		return this;
	}
    
    /** radians */
    rotate(radians: number): this {
		const old_x = this.x;
		this.x = this.x * Math.cos(radians) - this.y * Math.sin(radians);
        this.y = old_x * Math.sin(radians) + this.y * Math.cos(radians);
        return this;
    }

    /** Rotate vector in degrees */
    drotate(degrees: number): this {
        return this.rotate(degrees * DEG_TO_RAD);
    }
    
    floor(): this {
        this.x = floor(this.x);
        this.y = floor(this.y);
        return this;
    }
 
    normalize(): this {
        const len = this.length();
		// Don't want to divide by zero!
	    if (len > 0) {
	        this.x /= len;
	        this.y /= len;
        }
        return this;
    }
    
    isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }

    /** Set the length of the vector
     *  MAYBE: change this to a more intuitive name 
     */
    extend(magnitude: number): this {
		this.normalize();
		this.x *= magnitude;
		this.y *= magnitude;
		return this;
    }
    
    /** Takes in a NORMALIZED VECTOR, and bounce this vector inplace against that vector.*/
    bounce(normal: Coordinate): this {
        Vec2.bounce(this, normal, this);
        return this;
    }

    // isZero(): boolean {
    //     return this.x === 0 && this.y === 0; 
    // }

    clone(){
        return new Vec2(this.x, this.y);
    }

    toArray(): [number, number]{
        return [this.x, this.y];
    }

    toString(){
        return this.x + "," + this.y
    }

    toCoordinate(): Coordinate {
        return { x:this.x, y: this.y };
    }

    equals(vec: Coordinate){
        return this.x === vec.x && this.y === vec.y;
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
export function flattenVecArray(array: readonly Coordinate[]){
    return array.flatMap(vec => [vec.x, vec.y]);
}

/** Sets rotation of first input around the second input by the given degree expressed as a normalized vector */
export function rotatePoint(_point: Vec2, _center: Coordinate, _unit_circle: Coordinate): void {
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

