import { assert, AssertUnreachable } from "shared/misc/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { GamePacket } from "./packetdefinitions";
import { Vec2 } from "shared/shapes/vec2";
import { areEqualSorted, containsDuplicates } from "shared/datastructures/arrayutils";
import { DecodedTemplateType, DeserializeTypedVar, GetTemplateGeneric, NetworkVariableTypes, SharedTemplates, TypescriptTypeOfNetVar } from "./serialization";

export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
}


// Maybe DefineSchema<Schema>()
export function CreateDefinition<Format>(){
    return function<T extends Format>(value: T){
        return value;
    }
}


// The format to define networked entities
interface SharedNetworkEntityFormat {
    [key: string] : {
        // create: (...args: any[]) => void;
        events: {
            [key: string] : {
                argTypes: readonly [...NetworkVariableTypes[]],
                callback: (...args: any[]) => void;
            }
        }
        variables: {
            [key: string]: NetworkVariableTypes
        }
    }
}


/* Callback typing:
    -- Allows the type on the callback to be infered from the "argTypes". 
        - Takes type from the argTypes,
        - applies them to the labels of the callback
    TODO: override auto with specific. If the type doesn't extend any, use it by default.
*/

/*** Takes two tuples, and places the labels of the first tuple onto the second tuple
 * <Tuple with final labels, Tuple with final types>  */
export type MergeTupleLabels<Labels extends readonly any[], Types extends readonly any[]> = 
    { [key in keyof Labels]: key extends keyof Types ? Types[key] : never }

// Map tuple to its typescript types
export type TupleToTypescriptType<T extends readonly NetworkVariableTypes[]> = {
    //@ts-expect-error
    [Key in keyof T]: TypescriptTypeOfNetVar<T[Key]>
};

// type d = MergeTupleLabels<Parameters<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]["callback"]>,SharedNetworkedEntities["bullet"]["events"]["testEvent7"]["argTypes"]>
// type ds = MergeTupleLabels<Parameters<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]["callback"]>,TupleToTypescriptType<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]["argTypes"]>>

type NetCallbackTupleType<EVENT extends { argTypes: readonly [...NetworkVariableTypes[]], callback: (...args: any[]) => void }>
    //@ts-expect-error
    = MergeTupleLabels<Parameters<EVENT["callback"]>,TupleToTypescriptType<EVENT["argTypes"]>>

//@ts-expect-error
export type NetCallbackType<EVENT extends { argTypes: readonly [...NetworkVariableTypes[]], callback: (...args: any[]) => void }> = (...args: NetCallbackTupleType<EVENT>)=> void
    
type J = NetCallbackTupleType<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]>
type D = NetCallbackType<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]>

/** Linking networked entity classes */
export const SharedNetworkedEntityDefinitions = CreateDefinition<SharedNetworkEntityFormat>()({    
    "bullet": {
        create: () => void 0,
        variables: {
            _pos: { type:"vec2", subtype: "float" },
            test: { type: "number", subtype: "float"},
            //_dx: {type:"string"},
        },
        events: {
            testEvent7: {
                argTypes: [{ type: "template", subtype: SharedTemplates.ONE}, {type:"number", subtype:"uint8"}],
                callback: (point, testNumber) => void 0,
            },
            // asd: {
            //     argTypes: [{ type: "vec2", subtype: "float"}, {type:"number", subtype:"uint8"}],
            //     callback: (point: Vec2, testNumber: number) => void 0,
            // },
        }

    },
    "ogre": {
        create: () => void 0,
        variables: {
            _x: {type:"number", subtype: "float"},
            asdasd: {type:"number", subtype: "float"},
        },

        events: {

        }
    },
} as const);

export type SharedNetworkedEntities = typeof SharedNetworkedEntityDefinitions;








// Help with types https://stackoverflow.com/questions/63542526/merge-discriminated-union-of-object-types-in-typescript
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

type A = UnionToIntersection<SharedNetworkedEntities[keyof SharedNetworkedEntities]["variables"]>

type AllNetworkedVariablesWithTypes = {
    [K in keyof A] : TypescriptTypeOfNetVar<A[K]>
}


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

const orderedSharedEntityVariables: {variableName: keyof AllNetworkedVariablesWithTypes, type: NetworkVariableTypes}[][] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){

    const sharedName = sharedIDToNameLookup[i];
    const variableStruct = SharedNetworkedEntityDefinitions[sharedName]["variables"]
    
    const orderedVariables: (keyof AllNetworkedVariablesWithTypes)[] = Object.keys(variableStruct).sort() as any;

    const arr: {variableName: keyof AllNetworkedVariablesWithTypes, type: NetworkVariableTypes}[] = [];

    for(const variable of orderedVariables){
        arr.push({
            type: SharedNetworkedEntityDefinitions[sharedName]["variables"][variable],
            variableName: variable,
        });
    }

    orderedSharedEntityVariables[i] = arr;
}


const orderedSharedEntityEvents: {eventName: string, argtypes: NetworkVariableTypes[]}[][] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){

    const sharedName = sharedIDToNameLookup[i];
    const eventStruct = SharedNetworkedEntityDefinitions[sharedName]["events"]
    
    const orderedEvents: string[] = Object.keys(eventStruct).sort() as any;

    const arr: {eventName: string, argtypes: NetworkVariableTypes[]}[] = [];

    for(const variable of orderedEvents){
        arr.push({
            argtypes: SharedNetworkedEntityDefinitions[sharedName]["events"][variable]["argTypes"],
            eventName: variable,
        });
    }

    orderedSharedEntityEvents[i] = arr;
}

// Index is entityID, index into that array 
const sharedEntityEventToEventID: Map<string,number>[] = [];

for(let i = 0; i < orderedSharedEntities.length; i++){
    const map = new Map<string,number>();

    const orderedEventNames = orderedSharedEntityEvents[i].map(e => e.eventName).sort(e => e.localeCompare(e));

    for (let i = 0; i < orderedEventNames.length; i++) {
        const event = orderedEventNames[i];
        
        map.set(event,i);
    }

    sharedEntityEventToEventID[i] = map;
}



export const SharedEntityLinker = {

    validateNames(names: (keyof SharedNetworkedEntities)[]){
        assert(!containsDuplicates(names), "Duplicate entity definitions!");

        console.log(names);
        console.log(orderedSharedEntities);
        assert(areEqualSorted(orderedSharedEntities, names), "Entity amount mismatch");
    },

    // Makes sure all the variables are present
    validateVariables(name: keyof SharedNetworkedEntities, variables: (keyof AllNetworkedVariablesWithTypes)[]){

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

    validateEvents<T extends keyof SharedNetworkedEntities>(sharedName: T, variables: string[]){

        // Makes sure it has all the required variables
        const requiredVariables = orderedSharedEntityEvents[sharedNameToIDLookup.get(sharedName)];

        for(const varDefinition of requiredVariables){
            if(!variables.includes(varDefinition.eventName)){
                throw new Error(`Shared entity ${sharedName} does not include required event: ${varDefinition.eventName}`);
            }
        }
        
        //Checks for extra uneeded variables
        for(const eVar of variables){
            if(!requiredVariables.some(e => e.eventName === eVar)){
                throw new Error(`Shared entity ${name} has an unneeded event: ${eVar}`);
            }
        }

        if(requiredVariables.length !== variables.length){
            throw new Error(`Shared entity ${name} has an incorrect number of variable: ${variables.length - requiredVariables.length} too many`);
        }
    },

    eventNameToEventID<T extends keyof SharedNetworkedEntities, X extends keyof SharedNetworkedEntities[T]["events"]>(sharedName: T, eventName: X & string){
        
        return sharedEntityEventToEventID[this.nameToSharedID(sharedName)].get(eventName);

    },

    nameToSharedID(name: keyof SharedNetworkedEntities): number {
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

// The format to define networked entities
interface RemoteFunctionFormat {
    [key: string] : {
        argTypes: readonly [...NetworkVariableTypes[]],
        callback: (...args: any[]) => void;
    }
}

// Exported for versionhash
export const RemoteFunctionStruct = CreateDefinition<RemoteFunctionFormat>()({
    "test1": { 
        argTypes: [{type: "number", subtype: "int32"},{type: "number", subtype: "float"}],
        callback: (name, food) => void 0
    },
    "testVecFunction": {
        argTypes: [{type: "vec2", subtype: "double"}],
        callback: (testNumber) => void 0
    }

} as const);

export type RemoteFunction = typeof RemoteFunctionStruct;

// // Returns a tuple of the equivalent JS Types from the "int32" tuples
// type MappedTuple<Tuple> =  { 
//     [K in keyof Tuple]: Tuple[K] extends NetworkVariableTypes ? TypescriptTypeOfNetVar<Tuple[K]>  : never 
// };

// type B = (...args:MappedTuple<RemoteFunction["test"]["argTypes"]>) => void;

//const dddd: b = null;

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
            //@ts-expect-error
            SerializeTypedVar(stream,variableTypes[i], args[i])
        }
    },

    // Following two are used on client side 
    getStringFromID(id: number): keyof RemoteFunction {
        return IDToStringLookup[id];
    },

    callRemoteFunction(name: keyof RemoteFunction, stream: BufferStreamReader, entity: object, methodName: string){
        
        const args = []
        
        for(const functionArgumentType of RemoteFunctionStruct[name]["argTypes"]){
            const variable = DeserializeTypedVar(stream, functionArgumentType)
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
} as const;

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


