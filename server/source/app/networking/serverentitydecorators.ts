import { NetworkedVariableTypes, NetworkedEntityNames, SerializeEntityVariable } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ServerBearEngine } from "../serverengine";
import { ServerEntity } from "../serverentity";


/*
    On serialization, writes marked variables to buffer in alphabetical order

    How handle creation of entity?: 
        For now: constructors are empty --> Just create one and get it working
*/


type EntityNetworkedVariablesListType<T extends ServerEntity> = {
    variablename: keyof T,
    type: keyof NetworkedVariableTypes
}[]

// Place this decorator before variables to sync them automatically to client side
export function networkedvariable<T extends keyof NetworkedVariableTypes>(variableType: T) {

    // Property decorator
    return function<ClassPrototype extends ServerEntity>(target: ClassPrototype, propertyKey: keyof ClassPrototype){
        // Use this propertyKey to attach the event handler

       const constructorOfClass = target.constructor;
        
        if(constructorOfClass["VARIABLE_REGISTRY"] === undefined){
            constructorOfClass["VARIABLE_REGISTRY"] = [];
        }

        const variableslist = constructorOfClass["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<ClassPrototype>;
        variableslist.push({
            variablename: propertyKey,
            type: variableType,
        });

        console.log(`Added networked variable, ${propertyKey}, of type ${variableType}`)
    }
}



// Class decorator, makes it's variables updated over the network. Need client side implementation, networkedclass_client
export function networkedclass_server<T extends keyof NetworkedEntityNames>(classname: T) {

    return function<ClassConstructor extends typeof ServerEntity>(targetConstructor: ClassConstructor){

        type AbstractConstructorHelper<T> = (new (...args: any) => { [x: string]: any; }) & T;
        type indirection = AbstractConstructorHelper<ClassConstructor>;
        type instanceOfClass = InstanceType<indirection>;

        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<instanceOfClass>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will serialize in this order.
        // @ts-expect-error
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        let allVariables = "";
        for(const name of variableslist) allVariables += name.variablename;

        console.log(`Confirmed class, ${targetConstructor.name}, as networked entity. Contains the following variables: ${allVariables}`);
        
        targetConstructor["serializeVariables"] = function(entity: instanceOfClass,stream: BufferStreamWriter){            
            // This is the shared id across server, client --> it's how we implicitly link the classes
            stream.setUint16(entity.entityID);

            for(const variable of variableslist){
                SerializeEntityVariable(stream, entity[variable.variablename], variable.type);
            }
        }

        targetConstructor["SHARED_ID"] = -1;

        console.log("BearEngine,", ServerBearEngine);
        
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.push({
            //@ts-ignore-error
            create: targetConstructor,
            name: classname,
        })

    }
}



type EntityConstructor = new(...args:any[]) => ServerEntity;

 // This same thing exists on client-side as well
export class SharedEntityServerTable {
    private constructor(){}

    static readonly REGISTERED_NETWORKED_ENTITIES: {create: EntityConstructor, name: keyof NetworkedEntityNames}[] = [];
    static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();
}