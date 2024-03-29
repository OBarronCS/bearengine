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

import { random_int } from "shared/misc/random";
import { floor, lerp, string2hex } from "shared/misc/mathutils";


export function rgb(r: number,g: number,b: number,a = 1): Color{
    return new Color([r,g,b,a]);
}

/** r,g,a are integers in range [0,255]. a is a float in range [0,1] */
export class Color {

    static RED: Readonly<Color> = new Color([255,0,0,1]);
    static GREEN: Readonly<Color> = new Color([0,255,0,1]);
    static BLUE: Readonly<Color> = new Color([0,0,255,1]);
    static WHITE: Readonly<Color> = new Color([255,255,255,1]);

    static random(): Color {
        return new Color([random_int(0,256), random_int(0,256), random_int(0,256), 1]);
    }

    /** "[#]RRGGBB" */
    static from_string(str: string): Color {
        return this.from(string2hex(str));
    }

    /** 0xRRGGBB */
    static from(num: number): Color {
        const r = (num & 0xFF0000) >>> 16;
        const g = (num & 0x00FF00) >>> 8;
        const b = num & 0x0000FF;

        return new Color([r,g,b, 1]);
    }

    constructor(
        public values: [r: number, g: number, b: number, a: number]
    ){};

    clone(): Color {
        return new Color([...this.values])
    }

    copyFrom(color: Readonly<Color>): this {
        this.values[0] = color.values[0];
        this.values[1] = color.values[1];
        this.values[2] = color.values[2];
        this.values[3] = color.values[3];
        return this;
    }

    set_from_hex(num: number){
        this.r = (num & 0xFF0000) >>> 16;
        this.g = (num & 0x00FF00) >>> 8;
        this.b = num & 0x0000FF;
    }

    set(r: number, g: number, b: number): this {
        this.r = r;
        this.g = g;
        this.b = b;

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






