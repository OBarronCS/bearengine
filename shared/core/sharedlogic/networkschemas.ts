import { assert, AssertUnreachable } from "shared/misc/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { GamePacket } from "./packetdefinitions";
import { Vec2 } from "shared/shapes/vec2";


export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
}

//The following would allow entities to be checked BEFORE connecting to server.
//But, still need to validate stuff with live server on connect.
/** Linking networked entity classes */
export const SharedNetworkedEntityDefinitions = {
    "bullet": {
        create: () => void 0,
        variables: {
            _x: "float",
            _y: "float"
        },

    },
    "ogre": {
        create: () => void 0,
        variables: {
            _x: "float",
            asdasd: "float"
        },
    },
} as const;

export type SharedNetworkedEntity = typeof SharedNetworkedEntityDefinitions;

//#region Networked Variable Typing
// All of these types come together to extract all the variable keys
type OnlyNetworkedVariables = {
    [Key in keyof SharedNetworkedEntity]: SharedNetworkedEntity[Key]["variables"]
};

type AllSubVariables = OnlyNetworkedVariables[keyof OnlyNetworkedVariables]

// https://stackoverflow.com/questions/58434389/typescript-deep-keyof-of-a-nested-object
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]]

type Join<K, P> = K extends string | number ?
    P extends string | number ?
    `${K}${"" extends P ? "" : "."}${P}`
    : never : never;

type Leaves<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T] : "";

// All networked variable keys
export type AllNetworkedVariables = Leaves<AllSubVariables>

// Help with types https://stackoverflow.com/questions/63542526/merge-discriminated-union-of-object-types-in-typescript
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never


// This Types break if a key of two different objects that are equal have different values, because its impossible for the same key to have differnet 
type A = UnionToIntersection<SharedNetworkedEntity[keyof SharedNetworkedEntity]["variables"]>


export type AllNetworkedVariablesWithTypes = {
    [K in AllNetworkedVariables] : A[K]
}

//#endregion 

const orderedSharedEntities: (keyof typeof SharedNetworkedEntityDefinitions)[] = Object.keys(SharedNetworkedEntityDefinitions).sort() as any;

const sharedNameToIDLookup = new Map<keyof typeof SharedNetworkedEntityDefinitions, number>();
for(let i = 0; i < orderedSharedEntities.length; i++){
    sharedNameToIDLookup.set(orderedSharedEntities[i],i);
}

const sharedIDToNameLookup: (keyof typeof SharedNetworkedEntityDefinitions)[] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){
    sharedIDToNameLookup[i] = orderedSharedEntities[i];
}

// Index is shared index
const orderedSharedEntityVariables: {variableName: AllNetworkedVariables, type: NetworkedNumberTypes}[][] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){

    const sharedName = sharedIDToNameLookup[i];
    const variableStruct = SharedNetworkedEntityDefinitions[sharedName]["variables"]
    
    const orderedVariables: (AllNetworkedVariables)[] = Object.keys(variableStruct).sort() as any;

    const arr: {variableName: AllNetworkedVariables, type: NetworkedNumberTypes}[] = [];

    for(const variable of orderedVariables){
        arr.push({
            type: SharedNetworkedEntityDefinitions[sharedName]["variables"][variable],
            variableName: variable,
        });
    }

    orderedSharedEntityVariables[i] = arr;
}

export const SharedEntityLinker = {

    // Makes sure all the variables are present
    validateVariables(name: keyof SharedNetworkedEntity, variables: AllNetworkedVariables[]){

        // Makes sure it has all the required variables
        const requiredVariables = orderedSharedEntityVariables[sharedNameToIDLookup.get(name)];

        for(const varDefinition of requiredVariables){
            if(!variables.includes(varDefinition.variableName)){
                throw new Error(`Shared entity ${name} does not include required variable: ${varDefinition.variableName}`);
            }
        }
        
        //Checks for extra uneeded variables
        for(const eVar of variables){
            if(!requiredVariables.some(e => e.variableName === eVar)){
                throw new Error(`Shared entity ${name} has an unneeded variable: ${eVar}`);
            }
        }

        if(requiredVariables.length !== variables.length){
            throw new Error(`Shared entity ${name} has an incorrect number of variable: ${variables.length - requiredVariables.length} too many`);
        }
        
    },
    nameToSharedID(name: keyof SharedNetworkedEntity): number {
        return sharedNameToIDLookup.get(name);
    },
    sharedIDToVariables(id: number){
        return orderedSharedEntityVariables[id];
    }
}




//#region Remote function linking
/* 
    Server connects string to an integer, which the client decodes back into the string.
    Put function names into alphabetical order
        ID of a function name is its index in the array
*/

// Exported for versionhash
export const RemoteFunctionStruct = {
    "test1": { 
        argTypes: ["int32", "float"],
        callback: (name: number, food: number) => void 0
    },


    "testFunction": {
        argTypes: ["double"],
        callback: (testNumber: number) => void 0
    }

} as const;

export type RemoteFunction = typeof RemoteFunctionStruct;

// Returns a tuple of the equivalent JS Types from the "int32" tuples
// type MappedTuple<T> =  { 
//     [K in keyof T]: T[K] extends keyof NetworkedVariableTypes ? NetworkedVariableTypes[T[K]] : never 
// };

const orderedListOfFunctionNames: (keyof RemoteFunction)[] = Object.keys(RemoteFunctionStruct).sort() as any;

const stringToIDLookup = new Map<keyof RemoteFunction, number>();
for(let i = 0; i < orderedListOfFunctionNames.length; i++){
    stringToIDLookup.set(orderedListOfFunctionNames[i],i);
}

const IDToStringLookup: (keyof RemoteFunction)[] = [];
for(let i = 0; i < orderedListOfFunctionNames.length; i++){
    IDToStringLookup[i] = orderedListOfFunctionNames[i];
}

export const RemoteFunctionLinker = {
    // Used on server side
    getIDFromString(name: keyof RemoteFunction): number {
        return stringToIDLookup.get(name);
    },

    // Called by server
    serializeRemoteFunction<T extends keyof RemoteFunction>(name: T, stream: BufferStreamWriter, ...args: Parameters<RemoteFunction[T]["callback"]>): void {
        const variableTypes = RemoteFunctionStruct[name]["argTypes"];

        stream.setUint8(GamePacket.REMOTE_FUNCTION_CALL);
        stream.setUint8(this.getIDFromString(name));

        for (let i = 0; i < RemoteFunctionStruct[name]["argTypes"].length; i++) {
            SerializeTypedNumber(stream,variableTypes[i], args[i])
        }
    },

    // Following two are used on client side 
    getStringFromID(id: number): keyof RemoteFunction {
        return IDToStringLookup[id];
    },

    callRemoteFunction(name: keyof RemoteFunction, stream: BufferStreamReader, entity: object, methodName: string){
        
        const args = []
        
        for(const functionArgumentType of RemoteFunctionStruct[name]["argTypes"]){
            const variable = DeserializeTypedNumber(stream, functionArgumentType)
            args.push(variable);
        }

        entity[methodName](...args);
    }
}
//#endregion

//#region RESOURCE LINKING
export const RemoteResources = {
    LEVEL_ONE: "firsttest.json",
    LEVEL_TWO: "secondlevel.json",
}

const orderedResources: (keyof typeof RemoteResources)[] = Object.keys(RemoteResources).sort() as any;

const resourceToIDLookup = new Map<keyof typeof RemoteResources, number>();
for(let i = 0; i < orderedResources.length; i++){
    resourceToIDLookup.set(orderedResources[i],i);
}

const IDToResourceLookup: (keyof typeof RemoteResources)[] = [];
for(let i = 0; i < orderedResources.length; i++){
    IDToResourceLookup[i] = orderedResources[i];
}

export const RemoteResourceLinker = {
    // Used on server side
    getIDFromResource(name: keyof typeof RemoteResources): number {
        return resourceToIDLookup.get(name);
    },

    // Used on client side
    getResourceFromID(id: number): string {
        return RemoteResources[IDToResourceLookup[id]];
    },
}
//#endregion





// Serialization of structs
interface StructTemplate {
    [key: string]: NetworkedNumberTypes
}

type DecodedStruct<T> =  { 
    [K in keyof T]: T[K] extends NetworkedNumberTypes ? number : never 
};

//Uses iteration order of the StructType object to encode/decode;
export function StreamEncodeStruct<T extends StructTemplate>(stream: BufferStreamWriter, template: T, structToEncode: DecodedStruct<T>): void {
    for(const key in template){
        SerializeTypedNumber(stream, template[key], structToEncode[key]);
    }
}

export function StreamDecodeStruct<T extends StructTemplate>(stream: BufferStreamReader, template: T): DecodedStruct<T> {
    const obj = {} as DecodedStruct<T>;

    for(const key in template){
        // @ts-expect-error  this function returns a number, technically it could be something else
        obj[key] = DeserializeTypedNumber(stream, template[key]);
    }

    return obj;
}

//*********************** PUT ALL TEMPLATES HERE *********************// 
// Do not do -->    name: StructTemplate     , it breaks typing.
const VecStruct = {
    x: "double",
    y: "double",
} as const;


/*
Goal:
    Make schema which defines how to deserialize a TYPE in a stream.
*/

export type NetworkedNumberTypes = "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32"| "float" | "double";

type NumberType = {
    type: "number",
    subtype: NetworkedNumberTypes
} 

type StringType = {
    type: "string",
}

type ArrayType = {
    type: "array",
    subtype: AllNetTypeDefinitions
}

type Vec2Type = {
    type: "vec2",
    subtype: NetworkedNumberTypes;
}

type AllNetTypeDefinitions = NumberType |  StringType | ArrayType | Vec2Type;

type TypescriptTypeOfNetVar<T extends AllNetTypeDefinitions> = 
    T["type"] extends "number" ? number : 
        T["type"] extends "string" ? string :
            T["type"] extends "vec2" ? Vec2 :
                //@ts-expect-error --> It yells, but it still works!
                T["type"] extends "array" ? TypescriptTypeOfNetVar<T["subtype"]>[] : never;


// Bunch of types are yelling "ERROR" here but they still work when calling the function. So just internal.
export function SerializeTypedVar<T extends AllNetTypeDefinitions>(stream: BufferStreamWriter, def: T, value: TypescriptTypeOfNetVar<T>): void {

    switch(def.type){
        //@ts-expect-error
        case "number": SerializeTypedNumber(stream, def.subtype, value); break;
 
        //@ts-expect-error
        case "array": SerializeTypedArray(stream, def.subtype, value); break;
            
        //@ts-expect-error
        case "string": SerializeString(stream, value); break;

        //@ts-expect-error
        case "vec2": SerializeVec2(stream, def.subtype, value); break;

        default: AssertUnreachable(def);
    }
}


export function DeserializeTypedVar<T extends AllNetTypeDefinitions>(stream: BufferStreamReader, def: T): TypescriptTypeOfNetVar<T> {

    switch(def.type){
        //@ts-expect-error
        case "number": return DeserializeTypedNumber(stream, def.subtype);

        //@ts-expect-error
        case "array": return DeserializeTypedArray(stream, def.subtype); 
            
        //@ts-expect-error  
        case "string": return DeserializeString(stream);

        //@ts-expect-error
        case "vec2": return DeserializeVec2(stream, def.subtype);

        default: AssertUnreachable(def);
    }
}




export function SerializeTypedArray<T extends AllNetTypeDefinitions>(stream: BufferStreamWriter, def: T, arr: TypescriptTypeOfNetVar<T>[]): void {
    const length = arr.length;
    assert(length <= ((1 << 16) - 1), "Array must be less than 65536 values long --> " + arr);

    stream.setUint16(length);

    for (let i = 0; i < arr.length; i++) {
        SerializeTypedVar(stream, def, arr[i])        
    }
}

export function DeserializeTypedArray<T extends AllNetTypeDefinitions>(stream: BufferStreamReader, type: T, target: TypescriptTypeOfNetVar<T>[] = []): TypescriptTypeOfNetVar<T>[] {
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

const ASCII_REGEX = /^[\x00-\x7F]*$/;

export function SerializeString(stream: BufferStreamWriter, str: string): void {
    
    const length = str.length;

    assert(length <= ((1 << 16) - 1), "String must be less than 65536 characters --> " + str);
    assert(ASCII_REGEX.test(str), "Character must be ascii encodable --> " + str);
    

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