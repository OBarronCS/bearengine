import { DeserializeEntityVariable, NetworkedEntityNames, NetworkedVariableTypes } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamReader } from "shared/datastructures/networkstream";
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

/** Means a variable is being controlled by the server. Should be readonly on clientside */
export function remotevariable<T extends keyof NetworkedVariableTypes>(variableType: T) {

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


export function networkedclass_client<T extends keyof NetworkedEntityNames>(classname: T) {

    return function<U extends typeof Entity>(targetConstructor: U){
        type AbstractInstanceType<T> = T extends { prototype: infer U } ? U : never;
        type TypeOfInstance = AbstractInstanceType<U>;

        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<TypeOfInstance>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will deserialize in this order.
        // @ts-expect-error
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        let allVariables = "";
        for(const name of variableslist) allVariables += name.variablename;

        console.log(`Confirmed class, ${targetConstructor.name}, as client entity. Contains the following variables: ${allVariables}`);
        
        targetConstructor["deserializeVariables"] = function(entity: TypeOfInstance,stream: BufferStreamReader){
            for(const variable of variableslist){
                //@ts-expect-error
                entity[variable.variablename] = DeserializeEntityVariable(stream, variable.type);
            }
        }

        targetConstructor["SHARED_ID"] = -1;

        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.push({
            create: targetConstructor,
            name: classname,
        })
    }
}


type EntityConstructor = abstract new(...args:any[]) => Entity;

export class SharedEntityClientTable {
    private constructor(){}

    static readonly REGISTERED_NETWORKED_ENTITIES: {create: EntityConstructor, name: keyof NetworkedEntityNames}[] = [];
    static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();
}


