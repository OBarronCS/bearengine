import { DeserializeTypedVariable, SharedNetworkedEntity, NetworkedVariableTypes, AllNetworkedVariables, SharedEntityLinker } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { Entity } from "../entity";


/* 
    On client side, the variables need to be the same name as on server side

    Class decorator takes these remote variables, puts them in alphabetical order, and serializes that way
    
    Right now, I need to explicitly put the types. In future, maybe just make it part of an interface in shared, and then we put a shared "variable name" in the decorator? 
*/


type EntityNetworkedVariablesListType = {
    variablename: AllNetworkedVariables,
}[]

export function networkedclass_client<T extends keyof SharedNetworkedEntity>(classname: T) {

    return function<U extends typeof Entity>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1;

        // Validates that it has all the correct variables
        const variableslist = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType;

        const myVariables = variableslist.map(e => e.variablename);

        SharedEntityLinker.validateVariables(classname, myVariables)

        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.push({
            create: targetConstructor,
            name: classname,
        })
    }
}

/** Means a variable is being controlled by the server. Should be readonly on clientside */
export function remotevariable<K extends AllNetworkedVariables>(varName: K) {

    // Property decorator
    return function<T extends Entity>(target: T, propertyKey: K){
        // Use this propertyKey to attach the event handler

       const constructorOfClass = target.constructor;
        
        if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
            constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
        }

        const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType;
        variableslist.push({
            variablename: propertyKey,
        });
    }
}

type EntityConstructor = abstract new(...args:any[]) => Entity;


export class SharedEntityClientTable {
    private constructor(){}

    // This is a list of all the registered classes, registered using the '@networkedclass_client' decorator
    static readonly REGISTERED_NETWORKED_ENTITIES: {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntity,
    }[] = [];
    
    // Map of sharedID --> client class constructor
    private static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();

    static init(){
        // Sort shared entities by shared name, alphabetically so they match up on server side.
        // Index in array is the id
        for(let i = 0; i < SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES[i];

            registry.create["SHARED_ID"] = SharedEntityLinker.nameToSharedID(registry.name);

            SharedEntityClientTable.networkedEntityIndexMap.set(i,registry.create);
        }
    }

    static getEntityClass(sharedID: number): EntityConstructor {
        return SharedEntityClientTable.networkedEntityIndexMap.get(sharedID);
    }


    static deserialize(stream: BufferStreamReader, sharedID: number, entity: Entity){
        
        const variableslist = SharedEntityLinker.sharedIDToVariables(sharedID);

        for(const variableinfo of variableslist){
            entity[variableinfo.variableName] = DeserializeTypedVariable(stream, variableinfo.type);
        }

    }
}


