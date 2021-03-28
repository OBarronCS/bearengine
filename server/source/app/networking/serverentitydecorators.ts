import { NetworkedVariableTypes, NetworkedEntityNames, SerializeTypedVariable } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
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

/*
// Getters/setters live on the prototype chain, not on the instances
// Which is why it seems like the value is repeated multiple times in devtools

function dec2(target, propertyKey): any {

    Object.defineProperty(target, propertyKey, {
        get: function() {
            console.log('get', this['__'+propertyKey]);
            return this['__'+propertyKey];
        },
        set: function (value) {
            this['__'+propertyKey] = value;
            console.log('set', value);
        }
        // enumerable: true,
        // configurable: true
      }); 
};
*/

/**  Place this decorator before variables to sync them automatically to client side */
export function networkedvariable<K extends keyof NetworkedVariableTypes>(variableType: K) {

    // Property decorator
    return function<T extends ServerEntity>(target: T, propertyKey: keyof T){

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


// Class decorator, makes it's variables updated over the network. Need client side implementation, networkedclass_client
export function networkedclass_server<T extends keyof NetworkedEntityNames>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){


        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<ServerEntity>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will serialize in this order.
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        {
            let allVariables = "";
            for(const name of variableslist) allVariables += name.variablename + ",";
            console.log(`Confirmed class, ${targetConstructor.name}, as networked entity. Contains the following variables: ${allVariables}`);
        }

        targetConstructor["SHARED_ID"] = -1;        
        
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.push({
            variableslist: variableslist,
            name: classname,
            create: targetConstructor,
        })

    }
}


type EntityConstructor = abstract new(...args:any[]) => ServerEntity;

 // A similar thing to this exists on client-side as well
export class SharedEntityServerTable {
    private constructor(){}

    static readonly REGISTERED_NETWORKED_ENTITIES: {
        create: EntityConstructor, 
        name: keyof NetworkedEntityNames
        variableslist: EntityNetworkedVariablesListType<any>
    }[] = [];

    // Not in use on server side as of now 
    private static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();

    static init(){
        // Sort networked alphabetically, so they match up on client side
        // Index is SHARED_ID
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        for(let i = 0; i < SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES[i];

            SharedEntityServerTable.networkedEntityIndexMap.set(i,registry.create);

            registry.create["SHARED_ID"] = i;
        }
    }

    static serialize(stream: BufferStreamWriter, entity: ServerEntity){

        // Could make this a getter on the instance, I guess
        const SHARED_ID = entity.constructor["SHARED_ID"];

        stream.setUint8(SHARED_ID);
        stream.setUint16(entity.entityID);

        const variableslist = SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES[SHARED_ID].variableslist;

        for(const variable of variableslist){
            SerializeTypedVariable(stream, entity[variable.variablename], variable.type);
        }
    }
}

