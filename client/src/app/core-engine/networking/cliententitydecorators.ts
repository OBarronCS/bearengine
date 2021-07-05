import { SharedNetworkedEntities, SharedEntityLinker, SharedNetworkedEntityDefinitions, NetworkVariableTypes, DeserializeTypedVar, TypescriptTypeOfNetVar } from "shared/core/sharedlogic/networkschemas";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { floor, ceil, lerp } from "shared/misc/mathutils";
import { mix, Vec2 } from "shared/shapes/vec2";
import { DrawableEntity, Entity } from "../entity";





type RegisterVariablesList = {
    variablename: string,
    recieveFuncName: null | string;

    interpolated: boolean
}[];

type NetworkedVariablesList = {
    variablename: string,
    recieveFuncName: null | string;

    interpolated: boolean,

    variabletype: NetworkVariableTypes,
}[];

interface InterpolatedVarType<T> {
    value: T,
    buffer: InterpVariableData<any>
}

interface InterpVariableData<T> {
    addValue(frame: number, value: T): void,
    getValue(frame: number): T
}

export function InterpolatedVar<T>(value: T): InterpolatedVarType<T> {
    return {
        value: value,
        buffer: (typeof value === "number" ? new InterpNumberVariable() : new InterpVecVariable())
    }
}

class InterpNumberVariable implements InterpVariableData<number> {

    private values = new Map<number, number>();

    addValue(frame: number, value: number){
        this.values.set(frame, value);
    }

    getValue(frame: number){
        const first = this.values.get(floor(frame));
        const second = this.values.get(ceil(frame));

        if(first === undefined || second === undefined) {
            console.log("Cannot lerp");
            return 0;
        }

        return lerp(first, second, frame % 1)
    }
}

class InterpVecVariable implements InterpVariableData<Vec2> {

    private values = new Map<number, Vec2>();

    addValue(frame: number, value: Vec2){
        this.values.set(frame, value);
    }

    getValue(frame: number){
        const first = this.values.get(floor(frame));
        const second = this.values.get(ceil(frame));

        if(first === undefined || second === undefined) {
            console.log("Cannot lerp");
            return new Vec2(0,0);
        }

        return mix(first, second, frame % 1)
    }
}


type BaseEntityType = Entity;
type EntityClassType = typeof Entity;

// This helper types makes an error go away
type GetTypeScriptType<Var> = Var extends NetworkVariableTypes ? TypescriptTypeOfNetVar<Var> : never;

//decorator factory factory
export function net<SharedName extends keyof SharedNetworkedEntities>(name: SharedName){

    return {
        event<EventName extends keyof SharedNetworkedEntities[SharedName]["events"]>(eventName: EventName){
            return function<R extends BaseEntityType>(a: R, b: string, c: TypedPropertyDescriptor<SharedNetworkedEntities[SharedName]["events"][EventName]>){
                console.log("EVENT DEC");



            }
        },
        variable<VarName extends keyof SharedNetworkedEntities[SharedName]["variables"], OuterEntityType extends BaseEntityType>(varName: VarName, receiveFunc: (this: OuterEntityType, value: GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>) => void = undefined){
            return function<R extends BaseEntityType & Record<VarName,GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>>>(target: R, key: VarName & string){
                
                        // Target is prototype of class
                const constructorOfClass = target.constructor;

                if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
                    constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
                }

                let realReceiveFunc: string = null;

                if(receiveFunc !== undefined){
                    
                    //Add the onReceive function to the prototype
                    const recName = "__onReceive_" + varName;
                    target[recName] = receiveFunc;

                    realReceiveFunc = recName;
                }


                const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList;
                variableslist.push({
                    variablename: key,
                    recieveFuncName: realReceiveFunc,
                    interpolated: false,
                });
            }
        },
        interpolatedvariable<VarName extends keyof SharedNetworkedEntities[SharedName]["variables"], OuterEntityType extends BaseEntityType>(varName: VarName, receiveFunc: (this: OuterEntityType, value: GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>) => void = undefined){
            return function<T extends BaseEntityType & Record<VarName,InterpolatedVarType<GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>>>>(target: T, propertyKey: VarName & string){        

                const constructorOfClass = target.constructor;
                
                if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
                    constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
                }
        
                let realReceiveFunc: string = null;
        
                if(receiveFunc !== undefined){
                    
                    //Add the onReceive function to the prototype
                    const recName = "__onReceive_" + varName;
                    target[recName] = receiveFunc;
        
                    realReceiveFunc = recName;
                }
        
        
                const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList;
                variableslist.push({
                    variablename: propertyKey,
                    recieveFuncName: realReceiveFunc,
                    interpolated: true,
                });
            }
        }
    }
}

// function addRemoteVariableToClientEntity<
//     T extends BaseEntityType & Record<VarName,SharedNetworkedEntities[SharedName]["variables"][VarName]>, 
//         SharedName extends keyof SharedNetworkedEntities, 
//             VarName extends keyof SharedNetworkedEntities[SharedName]["variables"]>
//                 (target: T, key: VarName, sharedName: SharedName,varName: VarName, receiveFunc: (this: T, value: SharedNetworkedEntities[SharedName]["variables"][VarName]) => void = undefined){
// }

// export function remotevariable<T extends EntityType, K extends keyof AllNetworkedVariablesWithTypes>(varName: K, receiveFunc: (this: T, value: AllNetworkedVariablesWithTypes[K]) => void = undefined){
//     // Property decorator
//     return function<T extends EntityType & Record<K, AllNetworkedVariablesWithTypes[K]>>(target: T, propertyKey: K){        
//     }
// }

// // // Variable decorator
// export function interpolatedvariable<T extends EntityType, K extends keyof AllNetworkedVariablesWithTypes>(varName: K, receiveFunc: (this: T, value: AllNetworkedVariablesWithTypes[K]) => void = undefined){
    
//     // Property decorator

//     return function<T extends EntityType & Record<K, InterpolatedVarType<AllNetworkedVariablesWithTypes[K]>>>(target: T, propertyKey: K){        

//         const constructorOfClass = target.constructor;
        
//         if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
//             constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
//         }

//         let realReceiveFunc: string = null;

//         if(receiveFunc !== undefined){
            
//             //Add the onReceive function to the prototype
//             const recName = "__onReceive_" + varName;
//             target[recName] = receiveFunc;

//             realReceiveFunc = recName;
//         }


//         const variableslist = constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList;
//         variableslist.push({
//             variablename: propertyKey,
//             recieveFuncName: realReceiveFunc,
//             interpolated: true,
//         });
//     }
// }



export function networkedclass_client<T extends keyof SharedNetworkedEntities>(classname: T) {

    return function<U extends EntityClassType>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1;

        // Validates that it has all the correct variables

        // || returns the right side if left side is null or undefined
        const registeredVariables = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList || [];
        
        const orderedVariables =  registeredVariables.sort( (a,b) => a.variablename.localeCompare(b.variablename) );

        const orderedVariablesWithType: NetworkedVariablesList = orderedVariables.map( (a) => ({...a,
            variabletype : SharedNetworkedEntityDefinitions[classname]["variables"][a.variablename] as NetworkVariableTypes,
        }));

        SharedEntityLinker.validateVariables(classname, orderedVariables.map(a => a.variablename) as any);

        //Interpolation
        targetConstructor["INTERP_LIST"] = [];
        for(const v of orderedVariables){
            if(v.interpolated === true){
                targetConstructor["INTERP_LIST"].push(v.variablename);
            }
        }



        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.push({
            create: targetConstructor,
            name: classname,
            varDefinition: orderedVariablesWithType
        })
    }
}




type EntityConstructor = abstract new(...args:any[]) => BaseEntityType;

export const SharedEntityClientTable = {

    // This is a list of all the registered classes, registered using the '@networkedclass_client' decorator
    REGISTERED_NETWORKED_ENTITIES: [] as {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntities,
        varDefinition: NetworkedVariablesList
    }[],


    init(){
        
        // Order the list, index is SHARED_ID'

        this.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.localeCompare(b.name) );

        for(let i = 0; i < this.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = this.REGISTERED_NETWORKED_ENTITIES[i];

            // This should just be i;
            const SHARED_ID = SharedEntityLinker.nameToSharedID(registry.name);

            if(SHARED_ID !== i) {
                throw new Error("Networked Entity linking mismatch. Maybe: missing an entity")
            }

            registry.create["SHARED_ID"] = SHARED_ID;
        }
    },

    getEntityClass(sharedID: number): EntityConstructor {
        return this.REGISTERED_NETWORKED_ENTITIES[sharedID].create;
    },


    deserialize(stream: BufferStreamReader, frame: number, sharedID: number, entity: BaseEntityType){
        
        const variableslist = this.REGISTERED_NETWORKED_ENTITIES[sharedID].varDefinition

        for(const variableinfo of variableslist){
            const value = DeserializeTypedVar(stream, variableinfo.variabletype);

            if(variableinfo.interpolated){
                (entity[variableinfo.variablename] as InterpolatedVarType<any>).buffer.addValue(frame, value); 
            } else {
                entity[variableinfo.variablename] = value
            }


            if(variableinfo.recieveFuncName !== null){
                entity[variableinfo.recieveFuncName](value);
            }
        }

    }
}


