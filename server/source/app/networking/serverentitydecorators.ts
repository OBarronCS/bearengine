import { StreamWriteEntityID } from "shared/core/entitysystem";
import { SharedNetworkedEntities, SharedEntityLinker, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { NetworkVariableTypes, SerializeTypedVar, TypescriptTypeOfNetVar } from "shared/core/sharedlogic/serialization";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { TickTimer } from "shared/datastructures/ticktimer";
import { randomChar, randomInt } from "shared/misc/random";
import { ServerEntity } from "../entity";


// On entity serialization, it writes marked variables to buffer in agreed upon order
type RegisterVariablesList = {
    variablename: string
}[]


// Class decorator, makes it's variables updated over the network. Need client side implementation.
export function networkedclass_server<T extends keyof SharedNetworkedEntities>(classname: T) {

    return function<U extends typeof ServerEntity>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1; 
        targetConstructor["SHARED_NAME"] = classname;

        // Validates that it has all the correct variables
        const variableslist = targetConstructor.hasOwnProperty("NETWORKED_VARIABLE_REGISTRY") ? targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList : [];

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
                 

                // Ensure it doesn't get list from super class
                if(!constructorOfClass.hasOwnProperty("NETWORKED_VARIABLE_REGISTRY")){
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

        SharedEntityLinker.validateNames(this.REGISTERED_NETWORKED_ENTITIES.sort((a,b) => a.name.localeCompare(b.name)).map(e => e.name));
        
        for(let i = 0; i < this.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = this.REGISTERED_NETWORKED_ENTITIES[i];

            const SHARED_ID = SharedEntityLinker.nameToSharedID(registry.name);

            registry.create["SHARED_ID"] = SHARED_ID;
            this.networkedEntityIndexMap.set(SHARED_ID,registry.create);
        }



        for(const data of this.REGISTERED_NETWORKED_ENTITIES){

            // If the type for this class inherits from something, make sure this does too
            // Adds all the needed types to the variable definition, and sorts the list
            if(SharedNetworkedEntityDefinitions[data.name]["extends"]) {
                const shouldBe = SharedNetworkedEntityDefinitions[data.name]["extends"];
                // The super class of this class
                const parentConstructor = Object.getPrototypeOf(data.create);

                
                if(!parentConstructor.hasOwnProperty("SHARED_NAME") || parentConstructor["SHARED_NAME"]!== shouldBe){
                    throw new Error(`Class '${data.create.name}' should extend the class that implements shared type '${shouldBe}'`);
                }

                // data.varDefinition.push(...this.GetParentSharedEntityVariables(data.create));

                // data.varDefinition.sort((a,b) => a.variablename.localeCompare(b.variablename));
            }
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


@networkedclass_server("test_super")
export class S_T_Super extends ServerEntity {

    @sync("test_super").var("supervar")
    supervar = 1;

    update(dt: number): void {
        throw new Error("Method not implemented.");
    }

}

@networkedclass_server("test_sub")
export class S_T_Sub extends S_T_Super {

    @sync("test_sub").var("subvar", true)
    subvar = "Lmaoo!"


    timer = new TickTimer(40)

    override update(dt: number): void {
        if(this.timer.tick()){
            this.subvar = randomChar();
            this.supervar = randomInt(0,100000)
        }
    }
}
