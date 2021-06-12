import { DeserializeTypedVariable, SharedNetworkedEntity, NetworkedVariableTypes } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { Entity } from "../entity";


/* 
    On client side, the variables need to be the same name as on server side

    Class decorator takes these remote variables, puts them in alphabetical order, and serializes that way
    
    Right now, I need to explicitly put the types. In future, maybe just make it part of an interface in shared, and then we put a shared "variable name" in the decorator? 
*/


type EntityNetworkedVariablesListType<T extends Entity> = {
    variablename: keyof T,
    type: keyof NetworkedVariableTypes
}[]

export function networkedclass_client<T extends keyof SharedNetworkedEntity>(classname: T) {

    return function<U extends typeof Entity>(targetConstructor: U){

        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<Entity>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will deserialize in this order.
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        {   // Debug info
            let allVariables = "";
            for(const name of variableslist) allVariables += name.variablename + ",";
            console.log(`Confirmed class, ${targetConstructor.name}, as client entity. Contains the following variables: ${allVariables}`);
        }

        targetConstructor["SHARED_ID"] = -1;

        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.push({
            create: targetConstructor,
            name: classname,
            variablelist: variableslist
        })
    }
}

/** Means a variable is being controlled by the server. Should be readonly on clientside */
export function remotevariable<K extends keyof NetworkedVariableTypes>(variableType: K) {

    // Property decorator
    return function<T extends Entity>(target: T, propertyKey: keyof T){
        // Use this propertyKey to attach the event handler

       const constructorOfClass = target.constructor;
        
        if(constructorOfClass["VARIABLE_REGISTRY"] === undefined){
            constructorOfClass["VARIABLE_REGISTRY"] = [];
        }

        const variableslist = constructorOfClass["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<T>;
        variableslist.push({
            variablename: propertyKey,
            type: variableType,
        });

        console.log(`Added networked variable, ${propertyKey}, of type ${variableType}`)
    }
}

type EntityConstructor = abstract new(...args:any[]) => Entity;




export class SharedEntityClientTable {
    private constructor(){}

    // This is a list of all the registered classes, registered using the '@networkedclass_client' decorator
    static readonly REGISTERED_NETWORKED_ENTITIES: {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntity,
        variablelist: EntityNetworkedVariablesListType<any> // added through the "@remotevariable" decorator
    }[] = [];
    
    // Map of    sharedID --> client class constructor
    private static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();

    static init(){
        // Sort shared entities by shared name, alphabetically so they match up on server side.
        // Index in array is the id
        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) );
        for(let i = 0; i < SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES[i];
            SharedEntityClientTable.networkedEntityIndexMap.set(i,registry.create);
            registry.create["SHARED_ID"] = i;
        }
    }

    static getEntityClass(sharedID: number): EntityConstructor {
        return SharedEntityClientTable.networkedEntityIndexMap.get(sharedID);
    }


    static deserialize(stream: BufferStreamReader, sharedID: number, entity: Entity){
        
        const classInfo = SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES[sharedID];
        const variableslist = classInfo.variablelist;

        for(const variableinfo of variableslist){
            entity[variableinfo.variablename] = DeserializeTypedVariable(stream, variableinfo.type);
        }

    }
}


