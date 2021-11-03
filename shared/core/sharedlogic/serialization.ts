import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable, assert } from "shared/misc/assertstatements";
import { Vec2 } from "shared/shapes/vec2";
import { CommandHintFormat } from "../commands";


export function DefineSchema<Format>(){
    return function<T extends Format>(value: T){
        return value;
    }
}


// Serialization of object literals
// Better name than template. Literal? Struct?
interface TemplateFormat {
    [key: string]: NetworkVariableTypes
}

type DecodedTemplateType<T extends TemplateFormat> =  { 
    [K in keyof T]: TypescriptTypeOfNetVar<T[K]>; 
};

type GetTemplateGeneric<D> = D extends TemplateDecoder<infer R> ? R : never

class TemplateDecoder<T extends TemplateFormat> {
    
    format: T;

    orderedNameAndTypes: ({ key: keyof T, type: NetworkVariableTypes })[] = [];

    constructor(format: T){
        this.format = format;

        const orderedKeys: (keyof T)[] = Object.keys(format).sort();

        for(const key of orderedKeys){
            this.orderedNameAndTypes.push({
                key: key,
                type: format[key]
            })
        }
    }

    // Iterate alphabetical order, write using type
    serialize(stream: BufferStreamWriter, struct: DecodedTemplateType<T>){

        for(const varInfo of this.orderedNameAndTypes){
            // @ts-expect-error
            SerializeTypedVar(stream, varInfo.type, struct[varInfo.key]);
        }
    }

    deserialize(stream: BufferStreamReader): DecodedTemplateType<T> {
        const obj = {} as DecodedTemplateType<T>;

        for(const value of this.orderedNameAndTypes){
            obj[value.key] = DeserializeTypedVar(stream, value.type);
        }

        return obj;
    }
}



export function SerializeTemplate<D extends TemplateDecoder<TemplateFormat>>(stream: BufferStreamWriter, template: D, structToEncode: DecodedTemplateType<GetTemplateGeneric<D>>): void {
    template.serialize(stream, structToEncode);
}

export function DeserializeTemplate<D extends TemplateDecoder<TemplateFormat>>(stream: BufferStreamReader, template: D): DecodedTemplateType<GetTemplateGeneric<D>> {
    //@ts-expect-error
    return template.deserialize(stream);
}

// Distinction between TemplateFormat and Decoder is annoying.
// CreateStructDecoder(format)

// Name too vague
export function Template<T extends TemplateFormat>(format: Readonly<T>){
    return new TemplateDecoder(format);
}

//*********************** PUT SHARED TEMPLATES HERE *********************// 
export const SharedTemplates = DefineSchema<{ [key:string]: TemplateDecoder<any>}>()({
    
    ONE: Template({
        x:{type:"number", subtype:"float"},
        otherValue: {type:"vec2", subtype:"uint8"},
        arr: {type:"array", subtype : {type : "string"}}
    }),

    COMMANDS: Template({
        name: { type:"string" },
        args: { type:"array", subtype: {type:"array", subtype: {type: "string"}}}
    })

} as const);


export type GetTemplateRealType<T extends TemplateDecoder<any>> = DecodedTemplateType<GetTemplateGeneric<T>>;


/** Stands for NetworkedVariable */
export const netv = {
    uint8(){ return { type: "number", subtype: "uint8"} as const; },
    int8(){ return { type: "number", subtype: "int8"} as const; },

    uint16(){ return { type: "number", subtype: "uint16"} as const; },
    int16(){ return { type: "number", subtype: "int16"} as const; },

    uint32(){ return { type: "number", subtype: "uint32"} as const; },
    int32(){ return { type: "number", subtype: "int32"} as const; },

    float(){ return { type: "number", subtype: "float" } as const; },
    double(){ return { type: "number", subtype: "double" } as const; },

    array<T extends NetworkVariableTypes>(type: T){ return { type: "array", subtype: type} as const; },
    
    // Maybe make a way to insert a string to index the shared templates
    // bottom answer https://stackoverflow.com/questions/34798989/is-it-possible-to-overload-object-function-properties-in-typescript
    template<T extends TemplateFormat>(format: T){ return { type: "template", subtype: Template<T>(format)} as const; },

    // Maybe make it so can also input NumberType ==> netv.vec2(netv.uint8())
    vec2<T extends NetworkedNumberTypes>(type: T){ return { type: "vec2", subtype: type} as const; },
 
    string(){ return { type: "string" } as const; },
} as const;





type NetworkedNumberTypes = "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "float" | "double";


// Two ways:
// -> {type:"template", subtype: Template(????) }
// -> {type:"template", subtype: SharedTemplates.JUMP_INFO }

type TemplateType<T extends TemplateFormat> = {
    type: "template",
    subtype: TemplateDecoder<T>;
}

type NumberType = {
    type: "number",
    subtype: NetworkedNumberTypes
} 

type StringType = {
    type: "string",
}

type ArrayType = {
    type: "array",
    subtype: NetworkVariableTypes
}

type Vec2Type = {
    type: "vec2",
    subtype: NetworkedNumberTypes;
}

export type NetworkVariableTypes = NumberType |  StringType | ArrayType | Vec2Type | TemplateType<any>;

export type TypescriptTypeOfNetVar<T extends NetworkVariableTypes> = 
    T["type"] extends "number" ? number : 
        T["type"] extends "string" ? string :
            T["type"] extends "vec2" ? Vec2 :
            //@ts-expect-error --> It yells, but it still works!
                T["type"] extends "template" ? DecodedTemplateType<GetTemplateGeneric<T["subtype"]>> :
                    //@ts-expect-error --> It yells, but it still works!
                    T["type"] extends "array" ? TypescriptTypeOfNetVar<T["subtype"]>[] : never;


// Bunch of types are yelling "ERROR" here but they still work when calling the function. So just internal.
export function SerializeTypedVar<T extends NetworkVariableTypes>(stream: BufferStreamWriter, def: T, value: TypescriptTypeOfNetVar<T>): void {

    const type = def.type;

    switch(type){
        //@ts-expect-error
        case "number": SerializeTypedNumber(stream, def.subtype, value); break;
 
        //@ts-expect-error
        case "array": SerializeTypedArray(stream, def.subtype, value); break;
            
        //@ts-expect-error
        case "string": SerializeString(stream, value); break;

        //@ts-expect-error
        case "vec2": SerializeVec2(stream, def.subtype, value); break;

        //@ts-expect-error
        case "template": SerializeTemplate(stream, def.subtype, value); break;

        default: AssertUnreachable(type);
    }
}



export function DeserializeTypedVar<T extends NetworkVariableTypes>(stream: BufferStreamReader, def: T): TypescriptTypeOfNetVar<T> {

    const type = def.type;

    switch(type){
        //@ts-expect-error
        case "number": return DeserializeTypedNumber(stream, def.subtype);

        //@ts-expect-error
        case "array": return DeserializeTypedArray(stream, def.subtype); 
            
        //@ts-expect-error  
        case "string": return DeserializeString(stream);

        //@ts-expect-error
        case "vec2": return DeserializeVec2(stream, def.subtype);

        //@ts-expect-error
        case "template": return DeserializeTemplate(stream, def.subtype)

        default: AssertUnreachable(type);
    }
}




export function SerializeTypedArray<T extends NetworkVariableTypes>(stream: BufferStreamWriter, def: T, arr: TypescriptTypeOfNetVar<T>[]): void {
    const length = arr.length;
    assert(length <= ((1 << 16) - 1), "Array must be less than 65536 values long --> " + arr);

    stream.setUint16(length);

    for (let i = 0; i < arr.length; i++) {
        SerializeTypedVar(stream, def, arr[i])        
    }
}

export function DeserializeTypedArray<T extends NetworkVariableTypes>(stream: BufferStreamReader, type: T, target: TypescriptTypeOfNetVar<T>[] = []): TypescriptTypeOfNetVar<T>[] {
    const length = stream.getUint16();

    for(let i = 0; i < length; i++){
        target[i] = DeserializeTypedVar(stream, type);
    }
    
    return target;
}




export function SerializeVec2(stream: BufferStreamWriter, type: NetworkedNumberTypes, vec: Vec2): void {
    SerializeTypedNumber(stream, type, vec.x);
    SerializeTypedNumber(stream, type, vec.y);
}

export function DeserializeVec2(stream: BufferStreamReader, type: NetworkedNumberTypes, target: Vec2 = new Vec2(0,0)): Vec2 {
    target.x = DeserializeTypedNumber(stream, type);
    target.y = DeserializeTypedNumber(stream, type);
    return target;
}




export function SerializeTypedNumber(stream: BufferStreamWriter, type: NetworkedNumberTypes, value: number): void {

    switch(type){
        case "int8": stream.setInt8(value); break;
        case "uint8": stream.setUint8(value); break;
        case "int16": stream.setInt16(value); break;
        case "uint16": stream.setUint16(value); break;
        case "int32": stream.setInt32(value); break;
        case "uint32": stream.setUint32(value); break;
        case "float": stream.setFloat32(value); break;
        case "double": stream.setFloat64(value); break;
        
        default: AssertUnreachable(type);
    }
}

export function DeserializeTypedNumber(stream: BufferStreamReader, type: NetworkedNumberTypes): number {

    switch(type){
        case "int8": return stream.getInt8(); 
        case "uint8": return stream.getUint8(); 
        case "int16": return stream.getInt16(); 
        case "uint16": return stream.getUint16();
        case "int32": return stream.getInt32();
        case "uint32": return stream.getUint32();
        case "float": return stream.getFloat32();
        case "double": return stream.getFloat64();
        
        default: AssertUnreachable(type);
    }
}

// String serialization
// TextEncoder and TextDecoder cannot really write in pre-existing buffers. Not very useful
// Will do it manually, char by char,
// All ascii characters
// Fit in 1 byte

// Really, only values [32-126] (inclusive) are printable characters.
const PRINTABLE_ASCII_REGEX = /^[\x20-\x7E]*$/;

// const ASCII_REGEX = /^[\x00-\x7F]*$/;

export function StringIsPrintableASCII(str: string): boolean {
    return PRINTABLE_ASCII_REGEX.test(str);
}

/** Max (2^16 - 1) characters */
export function SerializeString(stream: BufferStreamWriter, str: string): void {
    
    const length = str.length;

    assert(length <= ((1 << 16) - 1), "String must be less than 65536 characters --> " + str);
    assert(StringIsPrintableASCII(str), "String must be ascii encodable --> " + str);
    

    stream.setUint16(length);

    for(const char of str){
        stream.setUint8(char.charCodeAt(0));
    }
}

export function DeserializeString(stream: BufferStreamReader): string {
    let str = "";

    const length = stream.getUint16();

    for(let i = 0; i < length; i++){
        str += String.fromCharCode(stream.getUint8());
    }
    
    return str;
}



/** Max 255 characters */
export function SerializeShortString(stream: BufferStreamWriter, str: string): void {
    
    const length = str.length;

    assert(length <= ((1 << 8) - 1), "String must be less than 256 characters --> " + str);
    assert(StringIsPrintableASCII(str), "String must be ascii encodable --> " + str);
    

    stream.setUint8(length);

    for(const char of str){
        stream.setUint8(char.charCodeAt(0));
    }
}


/** Max 255 characters */
export function DeserializeShortString(stream: BufferStreamReader): string {
    let str = "";

    const length = stream.getUint8();

    for(let i = 0; i < length; i++){
        str += String.fromCharCode(stream.getUint8());
    }
    
    return str;
}
