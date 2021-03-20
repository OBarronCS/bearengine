import { NetworkedVariableTypes, NetworkedEntityNames, SerializeEntityVariable } from "shared/core/sharedlogic/networkedentitydefinitions";
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

// According the TypeScript docs, this should not be working
// And it also doesn't follow the es-next new decorator proposal --> It's COMPLETELY different
// So it thinks that the return value is meaningless, but in fact, it

// Going to use: This shouldn't work, but it does on chrome. Use Object.defineProperties 
function dec(target, property): any {
    console.log(target)
    return {
        set: function (value) {
            // The reason this works is that the setter is being called immediately on init, so 'this' works
            this['__'+property] = value;
            console.log('set', value);
        },
        get: function() {
            console.log('get');
            return this['__'+property];
        },
        enumerable: true,
        configurable: true
    } ;
};

// DO IT THIS WAY
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
      }); 
};
*/

/**  Place this decorator before variables to sync them automatically to client side */
export function networkedvariable<T extends keyof NetworkedVariableTypes>(variableType: T) {

    // Property decorator
    return function<T extends ServerEntity>(target: T, propertyKey: keyof T){
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


// Class decorator, makes it's variables updated over the network. Need client side implementation, networkedclass_client
export function networkedclass_server<T extends keyof NetworkedEntityNames>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){

        type AbstractInstanceType<T> = T extends { prototype: infer U } ? U : never

        type TypeOfInstance = AbstractInstanceType<U>;

        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<TypeOfInstance>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will serialize in this order.
        // @ts-expect-error
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        let allVariables = "";
        for(const name of variableslist) allVariables += name.variablename;

        console.log(`Confirmed class, ${targetConstructor.name}, as networked entity. Contains the following variables: ${allVariables}`);
        
        targetConstructor["serializeVariables"] = function(entity: TypeOfInstance,stream: BufferStreamWriter){            
            stream.setUint16(entity.entityID);

            for(const variable of variableslist){
                SerializeEntityVariable(stream, entity[variable.variablename], variable.type);
            }
        }

        targetConstructor["SHARED_ID"] = -1;
        
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

