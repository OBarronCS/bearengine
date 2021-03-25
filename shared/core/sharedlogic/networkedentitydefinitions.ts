

import { AssertUnreachable } from "shared/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream";
import { GamePacket } from "./packetdefinitions";

/*
The following would allow things to be checked BEFORE connecting to server.
Would catch small errors.
But, still need to validate stuff with live server on connect.

NetworkEntityDefinitions = {
    // Could define client constructor stuff using this method
    "shared_class_name": {
        create: null as () => void,
        variables: {
            variable_name: type of variable,
            variable_name2: ect...
        }
    },
    "other_class": {

    }
} as const;

implementations would then have to use this "shared name" to linked variables. 
= IDEA: It could enforce making the entity property the same name as well. 

*/

export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
}



// Used to link client and server entity classes
export interface NetworkedEntityNames {
    "flying_tree": false,
    "auto": false 
}


/*
Remote function linking:
    Server needs to connect string to an id, which the client can decode back into the string.
    
    Here is how it does this (this code runs both on the client, server):
        iterate all properties on the RemoteFunctionStruct object, and insert them an array.
        Put them in alphabetical order (which will be the same no matter what)
        It's index in the array is now it's shared function id.
    
    Server:
        getIdFromString(keyof RemoteFunction) returns id. 
        It then writes this id in the packet it is sending

    client:
        uses the id from packet:
        getStringfromId(id): keyof RemoteFunction
            it can then associate a certain string to a certain function. 
*/

// A bit clunky, but it works well to allow both compiletime and runtime information. It gives contextual naming which is nice
const RemoteFunctionStruct = {
    "test1": ["int32", "float"] as any as (name: number, food: number) => void,


} as const;
export type RemoteFunction = typeof RemoteFunctionStruct;

// This all involves types from the first implementation of RemoteFunction types.
// // T is a tuple, TypeToIndex should have keys that are the tuple values 
// // Treat K as the index into the tuple
// type MappedTuple<T extends [...any[]],TypeToIndex> =  { 
//     [K in keyof T]: T[K] extends keyof TypeToIndex ? TypeToIndex[T[K]] : never 
// };

// type EXAMPLE_TYPE_9 = MappedTuple<Parameters<RemoteFunction["test1"]>,NetworkedVariableTypes>

// // Converts the "int32"s to number, ect, so get real TS typing
// type RemoteFunctionKeyTuple<T extends keyof RemoteFunction> = MappedTuple<Parameters<RemoteFunction[T]>, NetworkedVariableTypes>

// // This crazy type converts the types in the RemoteFunctionStruct to actually callback function definitions
// // so     (name: "int32", food: "float") => void      turns into (name: number, food: number) => void  
// // This error is WRONG. The type actually does work in the end, so just ignore this error
// // @ts-expect-error
// export type RemoteFunctionKeyToFunctionParameterType<T extends keyof RemoteFunction> = (...any: RemoteFunctionKeyTuple<T>) => void;

// type EXAMPLE_TYPE = RemoteFunctionKeyToFunctionParameterType<"test1">

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

    serializeRemoteFunction<T extends keyof RemoteFunction>(name: T, stream: BufferStreamWriter, ...args: Parameters<RemoteFunction[T]>): void {
        const variableTypes = RemoteFunctionStruct[name];

        stream.setUint8(GamePacket.REMOTE_FUNCTION_CALL);
        stream.setUint8(this.getIDFromString(name));

        for (let i = 0; i < RemoteFunctionStruct[name].length; i++) {
            SerializeEntityVariable(stream,args[i], variableTypes[i])
        }
    },

    // Following two are used on client side 
    getStringFromID(id: number): keyof RemoteFunction {
        return IDToStringLookup[id];
    },

    callRemoteFunction(name: keyof RemoteFunction, stream: BufferStreamReader, entity: Object, methodName: string){
        //he type is all messed up because I override it with function definition
        
        const args = []
        
        for(const functionArgumentType of RemoteFunctionStruct[name] as any as Iterable<keyof NetworkedVariableTypes>){
            const variable = DeserializeEntityVariable(stream, functionArgumentType)
            args.push(variable);
        }

        entity[methodName](...args);
    }
}


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





export function SerializeEntityVariable(stream: BufferStreamWriter, value: any, type: keyof NetworkedVariableTypes): void {

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

export function DeserializeEntityVariable(stream: BufferStreamReader, type: keyof NetworkedVariableTypes): number {

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
