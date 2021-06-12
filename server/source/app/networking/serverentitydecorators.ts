import { StreamWriteEntityID } from "shared/core/scene";
import { NetworkedVariableTypes, SharedNetworkedEntity, SerializeTypedVariable, AllNetworkedVariables, SharedNetworkedEntityDefinitions, SharedEntityLinker } from "shared/core/sharedlogic/networkedentitydefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ServerEntity } from "../serverentity";


// On entity serialization, it writes marked variables to buffer in agreed upon order

type EntityNetworkedVariablesListType = {
    variablename: AllNetworkedVariables
}[]


// Class decorator, makes it's variables updated over the network. Need client side implementation, networkedclass_client
export function networkedclass_server<T extends keyof SharedNetworkedEntity>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1; 

        // Validates that it has all the correct variables
        const variableslist = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType;

        const myVariables = variableslist.map(e => e.variablename);

        SharedEntityLinker.validateVariables(classname, myVariables)

    
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.push({
            name: classname,
            create: targetConstructor,
        });
    }
}


/**  Place this decorator before variables to sync them automatically to client side */
export function networkedvariable<K extends AllNetworkedVariables>(sharedVariableName: K, createSetterAndGetter = false) {

    // Property decorator
    return function<T extends ServerEntity>(target: T, propertyKey: K){

       const constructorOfClass = target.constructor;
        
        if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
            constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
        }

        const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as EntityNetworkedVariablesListType;
        variableslist.push({
            variablename: propertyKey,
        });

        // This makes it so the entity is marked dirty automatically when a variable changes
        if(createSetterAndGetter){


            Object.defineProperty(target, propertyKey, {
                get: function(this: ServerEntity) {
                    // console.log('get', this['__'+propertyKey]);
                    console.log("get");
                    return this['__'+propertyKey];
                },
                set: function (this: ServerEntity, value) {
                    this['__'+propertyKey] = value;
                    
                    console.log(`set ${propertyKey} to`, value);
                    
                    this.markDirty();
                },
                // enumerable: true,
                // configurable: true
            }); 

            console.log(target)
        }

    }
}




type EntityConstructor = abstract new(...args:any[]) => ServerEntity;

 // A similar thing to this exists on client-side as well
export class SharedEntityServerTable {
    private constructor(){}

    static readonly REGISTERED_NETWORKED_ENTITIES: {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntity
    }[] = [];

    // Not in use on server side as of now 
    private static readonly networkedEntityIndexMap = new Map<number,EntityConstructor>();

    static init(){
        // Index is SHARED_ID

        for(let i = 0; i < SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES[i];

            SharedEntityServerTable.networkedEntityIndexMap.set(i,registry.create);

            registry.create["SHARED_ID"] = SharedEntityLinker.nameToSharedID(registry.name);
        }
    }

    static serialize(stream: BufferStreamWriter, entity: ServerEntity){

        // Could make this a getter on the prototype,
        const SHARED_ID = entity.constructor["SHARED_ID"];

        const variableslist = SharedEntityLinker.sharedIDToVariables(SHARED_ID);

        
        stream.setUint8(SHARED_ID);
        StreamWriteEntityID(stream, entity.entityID);

        for(const variable of variableslist){
            SerializeTypedVariable(stream, entity[variable.variableName], variable.type);
        }
    }
}

