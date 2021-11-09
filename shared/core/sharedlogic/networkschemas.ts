import { assert } from "shared/misc/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { GamePacket } from "./packetdefinitions";
import { areEqualSorted, arrayDifference, arrayDuplicates, containsDuplicates } from "shared/datastructures/arrayutils";
import { DefineSchema, DeserializeTypedVar, netv, NetworkVariableTypes, SerializeTypedVar, SharedTemplates, TypescriptTypeOfNetVar } from "./serialization";
import { OnProjectileHitTerrain, SimpleWeaponControllerDefinition } from "./weapondefinitions";



export abstract class PacketWriter {
    savePacket: boolean;

    constructor(savePacket: boolean){
        this.savePacket = savePacket;
    }

    abstract write(stream: BufferStreamWriter): void;
} 



// The format to define networked entities
interface SharedNetworkEntityFormat {
    [key: string] : {
        // create: (...args: any[]) => void;
        extends: string | null
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

/** Linking networked entity classes */
export const SharedNetworkedEntityDefinitions = DefineSchema<SharedNetworkEntityFormat>()({    
    "item_entity": {
        extends: null,
        variables: {
            item_id: netv.uint8(),
            pos: netv.vec2("float")
        },
        events: {}
    },
    
    "weapon_item": {
        extends: null,
        static: {
            shoot_controller: null as SimpleWeaponControllerDefinition,
        },
        variables: {
            capacity: netv.uint32(),
            reload_time: netv.uint32(),
            ammo: netv.uint32()
        },
        events: {}
    },
    "terrain_carver_weapon": {
        extends: "weapon_item",
        variables: {
            
        },
        events: {},
    },
    "hitscan_weapon": {
        extends: "weapon_item",
        variables: {
            
        },
        events: {},
    },
    "projectile_bullet":{
        static:{
            on_terrain: null as OnProjectileHitTerrain[],
        },
        variables:{
            pos: netv.vec2("float"),
            velocity: netv.vec2("float"),
        },
        extends:null,
        events: {}
    },
    "forcefield_item": {
        extends: null,
        static: {
            radius:null as number
        },
        variables: {
            
        },
        events: {},
    },
    "ogre": {
        extends: null,
        variables: {
            _x: {type:"number", subtype: "float"},
            asdasd: {type:"number", subtype: "float"},
        },

        events: {

        }
    },
    
    "test_super": {
        extends: null,
        variables: {
            "supervar":netv.uint32()
        },
        events: {

        }
    },
    "test_sub": {
        extends: "test_super",
        variables: {
            "subvar":netv.string()
        },
        events: {

        }
    }
} as const);

export type SharedNetworkedEntities = typeof SharedNetworkedEntityDefinitions;


/* Callback typing:
    -- Allows the type on the callback to be infered from the "argTypes". 
        - Takes type from the argTypes, applies them to the labels of the callback (if the callback is any for that variable)
*/
//#region Callback typing

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N; 
// Return true if T is "any" type. False for all other types.
type IsExplicitlyAny<T> = IfAny<T, true, false>;

/*** Takes two tuples, and places the labels of the first tuple onto the second tuple if first label is not typed
 * <Tuple with final labels, Tuple with final types>  */
type MergeTupleLabels<Labels extends readonly any[], Types extends readonly any[]> = { 
    [key in keyof Labels]: 
        key extends keyof Types ?
            IsExplicitlyAny<Labels[key]> extends false ?
            Labels[key]  :
                Types[key] : never;
};

type MergeEventTuples<EVENT extends { argTypes: readonly [...NetworkVariableTypes[]], callback: (...args: any[]) => void }>
    = MergeTupleLabels<Parameters<EVENT["callback"]>,EVENT["argTypes"]>;

// V1
type TupleToTypescriptType<T extends readonly NetworkVariableTypes[]> = {
    //@ts-expect-error
    [Key in keyof T]: TypescriptTypeOfNetVar<T[Key]>
};

// type TEST_TYPE = MergeEventTuples<SharedNetworkedEntities["bullet"]["events"]["testEvent7"]>

/** Returns a tuple type */
export type NetCallbackTupleType<EVENT extends { argTypes: readonly [...NetworkVariableTypes[]], callback: (...args: any[]) => void }>
    =  TupleToTypescriptType<MergeEventTuples<EVENT>>;

export type NetCallbackTypeV1<EVENT extends { argTypes: readonly [...NetworkVariableTypes[]], callback: (...args: any[]) => void }> 
    //@ts-expect-error
    = (...args: NetCallbackTupleType<EVENT>) => void;
    
//#endregion


// NetEventArg, Parameter, NetCallback
export type NetArg<T extends keyof SharedNetworkedEntities, Event extends keyof SharedNetworkedEntities[T]["events"], I extends number> = 
    //@ts-expect-error
    NetCallbackTupleType<SharedNetworkedEntities[T]["events"][Event]>[I];


// Help with types https://stackoverflow.com/questions/63542526/merge-discriminated-union-of-object-types-in-typescript
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

type A = UnionToIntersection<SharedNetworkedEntities[keyof SharedNetworkedEntities]["variables"]>

type AllNetworkedVariablesWithTypes = {
    [K in keyof A] : TypescriptTypeOfNetVar<A[K]>
}


/***
 * Code to do with serialization shared entities
 */

/** Takes into account inheritance. Returns all variables for a given entity */



function __GetSharedEntityVariables(name: keyof SharedNetworkedEntities): { variableName: string, type: NetworkVariableTypes }[] {

    const allvarnames: string[] = [...Object.keys(SharedNetworkedEntityDefinitions[name]["variables"])];

    const allvars_withtypes: { variableName: string, type: NetworkVariableTypes }[] = allvarnames.map(e => { 
        return { variableName: e, type: SharedNetworkedEntityDefinitions[name]["variables"][e] }
    });

    const parent = SharedNetworkedEntityDefinitions[name]["extends"];
    if(parent !== null && parent !== ""){

        allvars_withtypes.push(...__GetSharedEntityVariables(parent));

    }

    // Sorts all variables alphabetically
    allvars_withtypes.sort((a,b) => a.variableName.localeCompare(b.variableName));

    return allvars_withtypes;
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



// Includes all inherited variables as well. Index is shared index
const AllOrderedSharedEntityVariables: {variableName: keyof AllNetworkedVariablesWithTypes, type: NetworkVariableTypes}[][] = [];
for(let i = 0; i < orderedSharedEntities.length; i++){

    const sharedName = sharedIDToNameLookup[i];
    const vars = __GetSharedEntityVariables(sharedName);
    //@ts-expect-error
    AllOrderedSharedEntityVariables[i] = vars;
   
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
        assert(!containsDuplicates(names),`Duplicate entity definitions: ${arrayDuplicates(names)}`);

        // console.log(names);
        // console.log(orderedSharedEntities);

        assert(areEqualSorted(orderedSharedEntities, names), `Entity amount mismatch: ${arrayDifference(orderedSharedEntities,names)}`);
    },

    // Makes sure all the variables are present
    validateVariables<SharedName extends keyof SharedNetworkedEntities>(name: SharedName, variables: (keyof AllNetworkedVariablesWithTypes)[]){

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

    eventNameToEventID<T extends keyof SharedNetworkedEntities, X extends keyof SharedNetworkedEntities[T]["events"]>(sharedName: T, eventName: X){
        
        //@ts-expect-error
        return sharedEntityEventToEventID[this.nameToSharedID(sharedName)].get(eventName);

    },

    nameToSharedID(name: keyof SharedNetworkedEntities): number {
        return sharedNameToIDLookup.get(name);
    },
    sharedIDToVariables(id: number){
        return AllOrderedSharedEntityVariables[id];
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
export const RemoteFunctionStruct = DefineSchema<RemoteFunctionFormat>()({
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


