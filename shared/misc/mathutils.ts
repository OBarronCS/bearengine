import { random_int } from "./random";

export function clamp(value: number, min: number, max: number){
    return Math.min(Math.max(value, min), max);
}

/** mix for numbers */
export function lerp(a: number, b: number, percent: number): number{
    return a * (1 - percent) + b * percent;
}

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

// Renaming for nicer syntax
export const E = Math.E;
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;
export const atan2 = Math.atan2;
export const cos = Math.cos;
export const sin = Math.sin;
export const dcos = (degrees: number) => cos(degrees * DEG_TO_RAD);
export const dsin = (degrees: number) => sin(degrees * DEG_TO_RAD);
export const abs = Math.abs;
export const min = Math.min;
export const max = Math.max;
export const sign = Math.sign;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const sqrt = Math.sqrt;

//JavaScript modulo is not a real modulo so this is not accurate with negative numbers
//https://community.khronos.org/t/fract-behaviour/62096
export const fract = (value: number): number => value % 1;

export function round(num: number, numbersAfterDecimal = 0): number {
    const rounder = Math.pow(10, numbersAfterDecimal);
    return Math.round(num * rounder) / rounder
}

export function step(edge: number, x: number): number{
    return x < edge ? 0 : 1;
}

/** Uses ===, don't use falsy values */
export function flip<T>(value: T, val1: T, val2: T): T {
    if(value === val1) 
        return val2;
    else 
        return val1;
}

export function smoothstep(leftedge: number, rightedge: number, x: number): number {
    const val = clamp((x - leftedge) / (rightedge - leftedge), 0, 1);
    return val * val * (3 - (2*val))
}


/** RADIANS, finds shortest angle difference between two angles */
export function angleDifference(from: number, to: number){
    const diff = to - from;
    return (diff + PI) % (2 * PI) - PI;
}

/** DEGREES */
export function dangleDifference(from: number, to: number){
    return angleDifference(from * DEG_TO_RAD, to * DEG_TO_RAD);
}

export function sum(values: readonly number[]): number {
    let sum = 0; 
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
    }
    return sum;
}

/** Assumes non-empty array */
export function mean(values: readonly number[]): number {
    return (sum(values) / values.length);
}

/** Assumes non-empty array */
export function median(values: readonly number[]): number {
    const orderedValues = [...values].sort((a,b) => a - b);

    // If even amount
    if(values.length % 2 === 0){
        const half = values.length / 2;
        return (orderedValues[half - 1] + orderedValues[half]) / 2;
    } else {
        return orderedValues[((values.length - 1) / 2)];
    }
    
}

/** Assumes non-empty array */
export function standardDeviation(values: readonly number[]): number {
    const average = mean(values);

    const diffArray = values.map(num => (num - average)**2);

    return sqrt(mean(diffArray));
}

//#region Date stuff
//returns the number of milliseconds elapsed since January 1, 1970.
export function time(){
    return Date.now();
}
    
/** 0 - 11 */
export function month(){
    const date = new Date();
    return date.getMonth();
}

export function year(){
    const date = new Date();
    return date.getFullYear();
}

/** 0-59 */
export function second(){
    const date = new Date();
    return date.getSeconds();
}

/** 0-59 */
export function minute(){
    const date = new Date();
    return date.getMinutes();
}

/** 0-23 */
export function hour(){
    const date = new Date();
    return date.getHours();
}
//#endregion


const colors = [
    "#ffa500 ",
    "#800000",
    "#daa520",
    "#b4eeb4",
    "#ff4040",
    "#990000",
    "#C70039",
    "#900C3F",
    "#EC7063",
]

export function niceColor(): number {
    const index = random_int(0,colors.length)
    return string2hex(colors[index]);
}

export function string2hex(str: string): number {
    if(str[0] === "#") str = str.substr(1);
    return Number.parseInt(str, 16);
}
    
export function isPow2(v: number): boolean {
    return !(v & (v - 1)) && (!!v);
}


// Offset doesn't work very well
// Takes in an angle, returns the angle that is it closest too with the offset
// DEGREES
// only accurate when roundToAngle goes perfectly into 360
function angleClosestTo(angle: number, roundToAngle: number, offset: number = 0){
    angle += 360;
    angle %= 360;
    return (Math.round((angle - offset) / roundToAngle) * roundToAngle) + offset
}



