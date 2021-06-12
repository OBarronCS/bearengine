

import { AssertUnreachable } from "shared/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { GamePacket } from "./packetdefinitions";

/*
The following would allow entities to be checked BEFORE connecting to server.
But, still need to validate stuff with live server on connect.


implementations would then have to use this "shared name" to linked variables. 
    would include all the 
        = IDEA: It could enforce making the entity property the same name as well. 

Auto correct won't work as each remotevariable doesn't know what shared_name to check for variables.
    Will be checked at runtime.

*/

/** Linking networked entity classes */
const NetworkedEntityDefinitions = {
    // Could define client constructor stuff using this method
    "bullet": {
        create: () => void 0,
        variables: {
            _x: "float",
            _y: "float"
        },
        events: {}
    },
} as const;

export type SharedNetworkedEntity = typeof NetworkedEntityDefinitions;















export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
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
            SerializeTypedVariable(stream,args[i], variableTypes[i])
        }
    },

    // Following two are used on client side 
    getStringFromID(id: number): keyof RemoteFunction {
        return IDToStringLookup[id];
    },

    callRemoteFunction(name: keyof RemoteFunction, stream: BufferStreamReader, entity: object, methodName: string){
        //he type is all messed up because I override it with function definition
        
        const args = []
        
        for(const functionArgumentType of RemoteFunctionStruct[name]["argTypes"]){
            const variable = DeserializeTypedVariable(stream, functionArgumentType)
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


export interface NetworkedVariableTypes {
    "int8": number,
    "uint8": number,
    "int16": number,
    "uint16": number,
    "int32": number,
    "uint32": number,
    "float": number,
    "double": number,
}


// Serialization of structs
interface StructTemplate {
    [key: string]: keyof NetworkedVariableTypes
}

type DecodedStruct<T> =  { 
    [K in keyof T]: T[K] extends keyof NetworkedVariableTypes ? NetworkedVariableTypes[T[K]] : never 
};

//Uses iteration order of the StructType object to encode/decode;
export function StreamEncodeStruct<T extends StructTemplate>(stream: BufferStreamWriter, template: T, structToEncode: DecodedStruct<T>): void {
    for(const key in template){
        SerializeTypedVariable(stream, structToEncode[key], template[key]);
    }
}

export function StreamDecodeStruct<T extends StructTemplate>(stream: BufferStreamReader, template: T): DecodedStruct<T> {
    const obj = {} as DecodedStruct<T>;

    for(const key in template){
        // @ts-expect-error  this function returns a number, technically it could be something else
        obj[key] = DeserializeTypedVariable(stream, template[key]);
    }

    return obj;
}

//*********************** PUT ALL TEMPLATES HERE *********************// 
// Do not do -->    name: StructTemplate     , it breaks typing.
const VecStruct = {
    x: "double",
    y: "double",
} as const;









export function SerializeTypedVariable(stream: BufferStreamWriter, value: any, type: keyof NetworkedVariableTypes): void {

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

export function DeserializeTypedVariable(stream: BufferStreamReader, type: keyof NetworkedVariableTypes): number {

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
