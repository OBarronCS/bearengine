import { StreamWriteEntityID } from "shared/core/scene";
import { SharedNetworkedEntity, SharedEntityLinker, AllNetworkedVariablesWithTypes, SerializeTypedVar } from "shared/core/sharedlogic/networkschemas";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ServerEntity } from "../serverentity";


// On entity serialization, it writes marked variables to buffer in agreed upon order

type RegisterVariablesList = {
    variablename: keyof AllNetworkedVariablesWithTypes
}[]


// Class decorator, makes it's variables updated over the network. Need client side implementation, networkedclass_client
export function networkedclass_server<T extends keyof SharedNetworkedEntity>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1; 

        // Validates that it has all the correct variables
        const variableslist = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList || [];

        const myVariables = variableslist.map(e => e.variablename);

        SharedEntityLinker.validateVariables(classname, myVariables)

    
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.push({
            name: classname,
            create: targetConstructor,
        });
    }
}


/**  Place this decorator before variables to sync them automatically to client side */
export function networkedvariable<K extends keyof AllNetworkedVariablesWithTypes>(sharedVariableName: K, createSetterAndGetter = false) {

    // Property decorator
    return function<T extends ServerEntity>(target: T, propertyKey: K){

       const constructorOfClass = target.constructor;
        
        if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
            constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
        }

        const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList;
        variableslist.push({
            variablename: propertyKey,
        });

        // This makes it so the entity is marked dirty automatically when a variable changes
        if(createSetterAndGetter){

            // *******************************************************************
            // *******************************************************************
            // *******************************************************************
            // WARNING: THIS IS BROKEN IN TYPESCRIPT 4.3. I ASSUME ITS A BUG IN TYPESCRIPT BECAUSE THE DOCS SAY NOTHING
            // In 4.3, the getter/setter does NOT override the instance property
            // 
            // The docs on decorators are not up to date, and perhaps returning a value here will have an effect despite the docs saying otherwise
            // ************************************************************************
            // *******************************************************************
            // *******************************************************************
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

            // console.log(target)
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

        for(let i = 0; i < this.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = this.REGISTERED_NETWORKED_ENTITIES[i];

            const SHARED_ID = SharedEntityLinker.nameToSharedID(registry.name);

            registry.create["SHARED_ID"] = SHARED_ID;
            this.networkedEntityIndexMap.set(SHARED_ID,registry.create);
        }
    }

    static serialize(stream: BufferStreamWriter, entity: ServerEntity){

        // Could make this a getter on the prototype,
        const SHARED_ID = entity.constructor["SHARED_ID"];

        const variableslist = SharedEntityLinker.sharedIDToVariables(SHARED_ID);

        
        stream.setUint8(SHARED_ID);
        StreamWriteEntityID(stream, entity.entityID);

        for(const variable of variableslist){

            //@ts-expect-error
            SerializeTypedVar(stream, variable.type, entity[variable.variableName]);
        }
    }
}

