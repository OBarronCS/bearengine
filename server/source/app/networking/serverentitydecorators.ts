import { StreamWriteEntityID } from "shared/core/scene";
import { SharedNetworkedEntities, SharedEntityLinker, SerializeTypedVar, NetworkVariableTypes, TypescriptTypeOfNetVar } from "shared/core/sharedlogic/networkschemas";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ServerEntity } from "../entity";


// On entity serialization, it writes marked variables to buffer in agreed upon order
type RegisterVariablesList = {
    variablename: string
}[]


// Class decorator, makes it's variables updated over the network. Need client side implementation.
export function networkedclass_server<T extends keyof SharedNetworkedEntities>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1; 

        // Validates that it has all the correct variables
        const variableslist = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList || [];

        const myVariables = variableslist.map(e => e.variablename);

        SharedEntityLinker.validateVariables(classname, myVariables as any)

    
        SharedEntityServerTable.REGISTERED_NETWORKED_ENTITIES.push({
            name: classname,
            create: targetConstructor,
        });
    }
}


type GetTypeScriptType<Var> = Var extends NetworkVariableTypes ? TypescriptTypeOfNetVar<Var> : never;

/**  Place this decorator before variables to sync them automatically to client side */
export function sync<SharedName extends keyof SharedNetworkedEntities>(sharedVariableName: SharedName) {

    return {
        var<VarName extends keyof SharedNetworkedEntities[SharedName]["variables"]>(key: VarName, createSetterAndGetter = false){
            return function<T extends ServerEntity & Record<VarName,GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>>>(target: T, propertyKey: VarName & string){

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
         
                     Object.defineProperty(target, propertyKey, {
                         get: function(this: ServerEntity) {
                             // console.log('get', this['__'+propertyKey]);
                             // console.log("get");
         
                             return this['__'+propertyKey];
                         },
                         set: function (this: ServerEntity, value) {
                             this['__'+propertyKey] = value;
                             
                             // console.log(`set ${propertyKey} to`, value);
                             
                             this.markDirty();
                         },
                         // enumerable: true,
                         // configurable: true
                     }); 
         
                     // console.log(target)
                 }
         
             }
        }
    }
    
}



type EntityConstructor = abstract new(...args:any[]) => ServerEntity;

 // A similar thing to this exists on client-side as well
export class SharedEntityServerTable {
    private constructor(){}

    static readonly REGISTERED_NETWORKED_ENTITIES: {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntities
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

        SharedEntityLinker.validateNames(this.REGISTERED_NETWORKED_ENTITIES.sort((a,b) => a.name.localeCompare(b.name)).map(e => e.name));
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

