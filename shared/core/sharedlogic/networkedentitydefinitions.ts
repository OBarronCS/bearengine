

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
export const SharedNetworkedEntityDefinitions = {
    // Could define client constructor stuff using this method
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
            test: "float",
            asdasd: "float"
        },
    },
} as const;

export type SharedNetworkedEntity = typeof SharedNetworkedEntityDefinitions;

//#region Networked Variable Typing
// All of these types come together to extra all the variable keys
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

export type AllNetworkedVariables = Leaves<AllSubVariables>
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
const orderedSharedEntityVariables: {variableName: AllNetworkedVariables, type: keyof NetworkedVariableTypes}[][] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){

    const sharedName = sharedIDToNameLookup[i];
    const variableStruct = SharedNetworkedEntityDefinitions[sharedName]["variables"]
    
    const orderedVariables: (AllNetworkedVariables)[] = Object.keys(variableStruct).sort() as any;

    const arr: {variableName: AllNetworkedVariables, type: keyof NetworkedVariableTypes}[] = [];

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
    validateVariables(name: keyof SharedNetworkedEntity, variables: AllNetworkedVariables[] | undefined){
        
        // TODO: Check for duplicates

        


        // Makes sure it has all the required variables
        const requiredVariables = orderedSharedEntityVariables[sharedNameToIDLookup.get(name)];

        if(variables === undefined) {
            if(requiredVariables.length !== 0) {
                throw new Error(`Shared entity ${name} is missing variables, ${requiredVariables.map(e => e.variableName).toString()}`);
            }
            return;
        }


        for(const varDefinition of requiredVariables){
            if(!variables.includes(varDefinition.variableName)){
                throw new Error(`Shared entity ${name} does not include required variable: ${varDefinition.variableName}`);
            }
        }
        
        //Checks for extra uneeded variables
        for(const eVar of variables){
            if(!requiredVariables.some(e => e.variableName === eVar)){
                throw new Error(`Shared entity ${name} has an uneeded variable: ${eVar}`);
            }
        }
    },
    nameToSharedID(name: keyof SharedNetworkedEntity): number {
        return sharedNameToIDLookup.get(name);
    },

    sharedIDToVariables(id: number){
        return orderedSharedEntityVariables[id];
    }


}


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
