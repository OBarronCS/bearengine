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

// 16.7 million options ---- 4096 options
hex --> #FFFFFF or #FFF
or start with 0xFFFFFF

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

hex with alpha --> two more digits, scaled 0-1 between 0 - 255
    #ffff000f

has hsl conversion algorithm
https://drafts.csswg.org/css-color/#funcdef-hsl
*/

import { lerp } from "./miscmath";


// export function rgb(rgb: [number,number,number]): Color;
export function rgb(r: number,g: number,b: number,a = 1): Color{
    return new Color([r,g,b,a]);
}

export class Color {
    constructor(
        public values: [number, number, number, number]
    ){};

    clone(): Color {
        return new Color([...this.values])
    }

    get r(){ return this.values[0]; }
    get g(){ return this.values[1]; }
    get b(){ return this.values[2]; }
    get a(){ return this.values[3]; }

    private valToHexString(val: number): string {
        let hex = val.toString(16);
        if (hex.length < 2) hex = "0" + hex;
        return hex;
    }

    hex(): string {
        return "#" + this.valToHexString(this.r) + this.valToHexString(this.g) + this.valToHexString(this.b);
    }

    value(): number {
        return (this.r*65536)+(this.g*256)+this.b;
    }
}
//* mix for colors */
export function blend(color1: Color, color2: Color, percent: number, target: Color = new Color([0,0,0,0])){
    for(let i = 0; i < 4; i++){
        target.values[i] = Math.round(lerp(color1.values[i], color2.values[i], percent));
    }

    return target;
}






