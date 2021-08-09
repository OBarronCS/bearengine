import { SharedNetworkedEntities, SharedEntityLinker, SharedNetworkedEntityDefinitions, NetCallbackTypeV1 } from "shared/core/sharedlogic/networkschemas";
import { DeserializeTypedVar, NetworkVariableTypes, TypescriptTypeOfNetVar } from "shared/core/sharedlogic/serialization";
import { areEqualSorted } from "shared/datastructures/arrayutils";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { floor, ceil, lerp, E } from "shared/misc/mathutils";
import { mix, Vec2 } from "shared/shapes/vec2";
import { Entity } from "../entity";




type RegisterVariablesList = {
    variablename: string,
    recieveFuncName: null | string;

    interpolated: boolean
}[];

type RegisterEventList = {
    eventname: string,
    methodname: string,
}[]



type NetworkedVariablesList = {
    variablename: string,
    recieveFuncName: null | string;

    interpolated: boolean,

    variabletype: NetworkVariableTypes,
}[];

type NetworkedEventList = {
    eventname: string,
    methodname: string;

    argumenttypes: NetworkVariableTypes[],
}[];




interface InterpolatedVarType<T> {
    value: T,
    buffer: InterpVariableBuffer<any>
}

interface InterpVariableBuffer<T> {
    addValue(frame: number, value: T): void,
    getValue(frame: number): T
}

export function InterpolatedVar<T>(value: T): InterpolatedVarType<T> {
    return {
        value: value,
        buffer: (typeof value === "number" ? new InterpNumberVariable() : new InterpVecVariable())
    }
}

class InterpNumberVariable implements InterpVariableBuffer<number> {

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

class InterpVecVariable implements InterpVariableBuffer<Vec2> {

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
            //@ts-expect-error 
            return function<R extends BaseEntityType>(target: R, key: string, desc: TypedPropertyDescriptor<NetCallbackTypeV1<SharedNetworkedEntities[SharedName]["events"][EventName]>>){
                
                const constructorClass = target.constructor;

                // Deals with inheriting super class events
                if(!constructorClass.hasOwnProperty("NETWORKED_EVENT_REGISTRY")){

                    let parentEvents = [];
                    if(constructorClass["NETWORKED_EVENT_REGISTRY"] !== undefined){
                        parentEvents.push(...constructorClass["NETWORKED_EVENT_REGISTRY"]);
                    }

                    constructorClass["NETWORKED_EVENT_REGISTRY"] = [...parentEvents];
                }
                

                const eventlist = constructorClass["NETWORKED_EVENT_REGISTRY"] as RegisterEventList;

                //Make sure only one of this event type has been added to this entity
                if(eventlist.some((a) =>a.eventname === eventName)){
                    throw new Error("Cannot have multiple methods assoicated with the same event: " + eventName);
                }

                eventlist.push({
                    eventname: eventName as string,
                    methodname: key,
                });
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

// register_clientnetworkedentity
// register_client_net_entity()
// OR add it to the ne vars
//  --> Pull out inner code into a function in that case
// netv("name").class;
// 


export function networkedclass_client<T extends keyof SharedNetworkedEntities>(classname: T) {

    return function<U extends EntityClassType>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1;

        // Validates variables
        const registeredVariables = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList || [];
        
        const orderedVariables = registeredVariables.sort( (a,b) => a.variablename.localeCompare(b.variablename) );

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


        // Validate events
        const registeredEvents = targetConstructor["NETWORKED_EVENT_REGISTRY"] as RegisterEventList || [];
        
        const orderedEvents = registeredEvents.sort( (a,b) => a.eventname.localeCompare(b.eventname) );

        const orderedEventsWithType: NetworkedEventList = orderedEvents.map( (a) => ({...a,
            argumenttypes : SharedNetworkedEntityDefinitions[classname]["events"][a.eventname]["argTypes"] as NetworkVariableTypes[],
        }));

        SharedEntityLinker.validateEvents(classname, orderedEvents.map(a => a.eventname) as any);




        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.push({
            create: targetConstructor,
            name: classname,
            varDefinition: orderedVariablesWithType,
            eventDefinition: orderedEventsWithType,
        })
    }
}




type EntityConstructor = abstract new(...args:any[]) => BaseEntityType;

export const SharedEntityClientTable = {

    // List of all the classes registered using the decorator
    REGISTERED_NETWORKED_ENTITIES: [] as {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntities,
        varDefinition: NetworkedVariablesList
        eventDefinition: NetworkedEventList,
    }[],


    init(){
        
        // Order the list, index is SHARED_ID'

        this.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.localeCompare(b.name) );


        SharedEntityLinker.validateNames(this.REGISTERED_NETWORKED_ENTITIES.map(e => e.name));


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

    callRemoteEvent(stream: BufferStreamReader, sharedID: number, eventID: number, entity: BaseEntityType){
        

        const eventDefinition = this.REGISTERED_NETWORKED_ENTITIES[sharedID].eventDefinition[eventID];

        const args = []
        
        for(const functionArgumentType of eventDefinition.argumenttypes){
            const variable = DeserializeTypedVar(stream, functionArgumentType)
            args.push(variable);
        }

        entity[eventDefinition.methodname](...args);
    },

    readThroughRemoteEventStream(stream: BufferStreamReader, sharedID: number, eventID: number, entity: BaseEntityType){
        const eventDefinition = this.REGISTERED_NETWORKED_ENTITIES[sharedID].eventDefinition[eventID];
        
        for(const functionArgumentType of eventDefinition.argumenttypes){
            DeserializeTypedVar(stream, functionArgumentType)
        }
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


