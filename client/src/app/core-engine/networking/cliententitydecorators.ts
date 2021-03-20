import { DeserializeEntityVariable, NetworkedEntityNames, NetworkedVariableTypes } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamReader } from "shared/datastructures/networkstream";
import { Entity } from "../entity";
import { NetworkReadSystem } from "./networkread";


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
    return function<ClassPrototype extends Entity>(target: ClassPrototype, propertyKey: keyof ClassPrototype){
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

/*
class Test {

    @dec2
    test = 1
}

const t1 = new Test();
const t2 = new Test();

console.log(t1);
console.log(t2);

t1.test = -100;
t2.test = 6;

console.log(t1);
console.log(t2);


// Getters/setters live on the prototype chain, not on the instances
// Which is why it seems like the value is repeated multiple times in devtools

// According the TypeScript docs, this should not be working
// And it also doesn't follow the es-next new decorator proposal --> It's COMPLETELY different
// But it at least works in
// So it thinks that the return value is meaningless, but in fact, it
// However, it still gives the followiing:

// Going to use: This shouldn't work, but it does on chrome. Could use Object.defineProperties as other workaround
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


export function networkedclass_client<T extends keyof NetworkedEntityNames>(classname: T) {

    return function<ClassConstructor extends typeof Entity>(targetConstructor: ClassConstructor){

        type AbstractConstructorHelper<T> = (new (...args: any) => { [x: string]: any; }) & T;
        type indirection = AbstractConstructorHelper<ClassConstructor>;
        type instanceOfClass = InstanceType<indirection>;

        const variableslist = targetConstructor["VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType<instanceOfClass>;
        if(variableslist === undefined) throw new Error("No variables added to networked entity");
        
        // Alphabetically sorts them keys, will deserialize in this order.
        // @ts-expect-error
        variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        let allVariables = "";
        for(const name of variableslist) allVariables += name.variablename;

        console.log(`Confirmed class, ${targetConstructor.name}, as client entity. Contains the following variables: ${allVariables}`);
        
        targetConstructor["deserializeVariables"] = function(entity: instanceOfClass,stream: BufferStreamReader){
            for(const variable of variableslist){
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


