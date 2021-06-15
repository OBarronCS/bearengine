/* 
look into use Proxy object to do swizzling
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy

get --> getting any property
set -->
construct --> override constructor'
call --> function call

first parameter is target objext --> the vec
// second is the handler
const obj = new Proxy({}, {
  get: function (target, key, receiver) {
    console.log(`getting ${key}!`);
    return Reflect.get(target, key, receiver);
  },
  set: function (target, key, value, receiver) {
    console.log(`setting ${key}!`);
    return Reflect.set(target, key, value, receiver);
  }
});

hsl --> rbg under the hood but different way to thing about it
HUE, SATURATION, LIGHTNESS
0 - 360, 0 - 100%, 0 - 100%

HUE
    --> position on color wheel (an angle)
    --> the base tone
SATURATION -->
LIGHTNESS/DARKNESS
    0 is black
    .5 is pretty much just the hue
    1 is white
has hsl conversion algorithm
https://drafts.csswg.org/css-color/#funcdef-hsl
*/

import { randomInt } from "shared/misc/random";
import { utils } from "pixi.js";
import { floor, lerp } from "shared/misc/mathutils";


export function rgb(r: number,g: number,b: number,a = 1): Color{
    return new Color([r,g,b,a]);
}

export class Color {

    static RED = new Color([255,0,0,1]);
    static GREEN = new Color([0,255,0,1]);
    static BLUE = new Color([0,0,255,1]);

    static random(): Color {
        return new Color([randomInt(0,256), randomInt(0,256), randomInt(0,256), 1]);
    }

    static fromString(str: string): Color {
        return this.fromNumber(utils.string2hex(str));
    }

    static fromNumber(num: number): Color {
        const rgb = utils.hex2rgb(num).map(v => floor(v * 255));
        
        // @ts-expect-error
        return new Color([...rgb, 1]);
    }

    constructor(
        public values: [number, number, number, number]
    ){};

    clone(): Color {
        return new Color([...this.values])
    }

    copyFrom(color: Color): this {
        this.values[0] = color.values[0];
        this.values[1] = color.values[1];
        this.values[2] = color.values[2];
        this.values[3] = color.values[3];
        return this;
    }

    set r(val: number){ this.values[0] = val; }
    set g(val: number){ this.values[1] = val; }
    set b(val: number){ this.values[2] = val; }
    set a(val: number){ this.values[3] = val; }

    get r(){ return this.values[0]; }
    get g(){ return this.values[1]; }
    get b(){ return this.values[2]; }
    get a(){ return this.values[3]; }

    private valToHexString(val: number): string {
        let hex = val.toString(16);
        if (hex.length < 2) hex = "0" + hex;
        return hex;
    }

    string(): string {
        return "#" + this.valToHexString(this.r) + this.valToHexString(this.g) + this.valToHexString(this.b);
    }

    hex(): number {
        return (this.r*65536)+(this.g*256)+this.b;
    }

    // equals?
}
//* mix for colors */
export function blend(color1: Color, color2: Color, percent: number, target: Color = new Color([0,0,0,0])){
    for(let i = 0; i < 4; i++){
        target.values[i] = Math.round(lerp(color1.values[i], color2.values[i], percent));
    }

    return target;
}






