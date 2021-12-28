import { AbstractEntity } from "shared/core/abstractentity";
import { SharedNetworkedEntities, SharedEntityLinker, SharedNetworkedEntityDefinitions, NetCallbackTypeV1 } from "shared/core/sharedlogic/networkschemas";
import { DeserializeTypedVar, DeserializeVec2, NetworkVariableTypes, TypescriptTypeOfNetVar } from "shared/core/sharedlogic/serialization";
import { areEqualSorted } from "shared/datastructures/arrayutils";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { floor, ceil, lerp, E } from "shared/misc/mathutils";
import { mix, Vec2 } from "shared/shapes/vec2";




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




export interface InterpolatedVarType<T> {
    value: T,
    buffer: InterpVariableBuffer<any>
}


interface InterpVariableBuffer<T> {
    addValue(frame: number, value: T): void,
    getValue(frame: number): T
}

abstract class AbstractInterpolatedVariable<T> implements InterpVariableBuffer<T> {

    protected abstract default_value: T;
    
    private buffer: {frame: number, data:T}[] = [];

    addValue(frame: number, value: T): void {
        this.buffer.push({
            frame: frame,
            data: value,
        });
    }

    /**
     * Use cases for interpolation:
        Position, angle.
            These are things that should be sent every tick if value is different. Else, not sent
     * The values are stored stored sequentially
            [{tick: integer, data: T}, data_1, data_2, data_3];

            To grab a piece of data. Go from right to left. 

                Find an an item with a tick that is LESS than passed in frame (float) tick.
                If you don't find two data points exactly surrounding the tick, it means the server did not send a value for that tick because the value did not change.
                    Edge cases:
                        0,1 values;
                            If 0 values, return default.
                            If 1 value, return that value.

                        No value exists that is new enough; (at the right)
                            Return the newest

                        No value exists that is old enough; (at the left)
                            Return oldest
                                Could make it return default (like offscreen)
     */
    getValue(frame: number): T {
        if(this.buffer.length === 0) return this.default_value;
        if(this.buffer.length === 1) return this.buffer[0].data;

        for(let i = this.buffer.length - 1; i > 0; --i){
            if(this.buffer[i].frame < frame){
                
                
                if(i === this.buffer.length - 1){
                    // If this branch is taken, it means we are missing the latest tick to interpolate
                    return this.buffer[i].data;
                } else {
                    //If the two data values were received in back to back frames
                    if(this.buffer[i+1].frame === this.buffer[i].frame + 1){
                        return this.getInterpolatedValue(this.buffer[i].data, this.buffer[i+1].data, frame % 1);
                    } else {
                        // If the next frame is a new value, interp between that and the last value received
                        // This is under the assumption that if the value does not change, then we do we not add anything to the buffer
                        if(this.buffer[i+1].frame === floor(frame) + 1){
                            return this.getInterpolatedValue(this.buffer[i].data, this.buffer[i+1].data, frame % 1);
                        } else {
                            return this.buffer[i].data;
                        }
                    }
                }
            }
        }

        // If function has not returned, it means we don't have old enough values to interpolate 
        // return this.default_value;
        return this.buffer[0].data;
    }

    abstract getInterpolatedValue(a: T, b: T, t: number): T;

}

export function InterpolatedVar<T>(default_value: T): InterpolatedVarType<T> {
    return {
        value: default_value,
        buffer: (typeof default_value === "number" ? new InterpNumberVariable() : new InterpVecVariable())
    }
}

class InterpNumberVariable extends AbstractInterpolatedVariable<number> {
    protected default_value: number = 0;
    
    getInterpolatedValue(a: number, b: number, t: number): number {
        return lerp(a, b, t)
    }


}

class InterpVecVariable extends AbstractInterpolatedVariable<Vec2> {
    protected default_value: Vec2 = new Vec2(0,0);

    getInterpolatedValue(a: Vec2, b: Vec2, t: number): Vec2 {
        return mix(a,b,t);
    }

  
}


type BaseEntityType = AbstractEntity<any>; // Entity;
type EntityClassType = new() => AbstractEntity<any>;

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

                // Ensure it doesn't get list from super class
                if(!constructorOfClass.hasOwnProperty("NETWORKED_VARIABLE_REGISTRY")){
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
            return function<T extends BaseEntityType & Record<VarName,GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>>>(target: T, propertyKey: VarName & string){        
            // return function<T extends BaseEntityType & Record<VarName,InterpolatedVarType<GetTypeScriptType<SharedNetworkedEntities[SharedName]["variables"][VarName]>>>>(target: T, propertyKey: VarName & string){        

                const constructorOfClass = target.constructor;
                
                if(constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] === undefined){
                    constructorOfClass["NETWORKED_VARIABLE_REGISTRY"] = [];
                }
           
                // Replaces the variable with a custom setter/getter, for a nice API
                // Getting the value will return the current interpolated value,
                // setting it will create the buffer and initial value. 
                // ONLY SET IT ONCE.

                const underlying_property = "__" + propertyKey;

                Object.defineProperty(target, propertyKey, {

                    get(){
                        return this[underlying_property];
                    },
                    // This should ONLY BE CALLED ONCE, in the public setter
                    set(value){
                        this[underlying_property] = value;
                        this[underlying_property + "__BUFFER_"] = InterpolatedVar<T[VarName]>(value);
                    },
                });
                
        

                 
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
        targetConstructor["SHARED_NAME"] = classname;

        // Validates variables
        const registeredVariables = targetConstructor.hasOwnProperty("NETWORKED_VARIABLE_REGISTRY") ? targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList : [];
        
        const orderedVariables = registeredVariables.sort( (a,b) => a.variablename.localeCompare(b.variablename) );

        
        SharedEntityLinker.validateVariables(classname, orderedVariables.map(a => a.variablename) as any);



        const orderedVariablesWithType: NetworkedVariablesList = orderedVariables.map( (a) => ({...a,
            variabletype : SharedNetworkedEntityDefinitions[classname]["variables"][a.variablename] as NetworkVariableTypes,
        }));


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

        SharedEntityLinker.validateEvents(classname, orderedEvents.map(a => a.eventname));



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

    FINAL_REGISTERED_NETWORKED_ENTITIES: [] as {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntities,
        varDefinition: NetworkedVariablesList
        eventDefinition: NetworkedEventList,
    }[],

    /* Only includes variables from PARENTS */
    GetParentSharedEntityVariables(con: EntityConstructor): NetworkedVariablesList {

        const vars: NetworkedVariablesList = [];

        // If the type for this class inherits from something, make sure this does too
        if(SharedNetworkedEntityDefinitions[con["SHARED_NAME"]]["extends"]) {
            const shouldBe = SharedNetworkedEntityDefinitions[con["SHARED_NAME"]]["extends"];
            
            // The super class of this class
            const parentConstructor = Object.getPrototypeOf(con);
            
            if(parentConstructor["SHARED_NAME"] !== shouldBe){
                throw new Error(`Class '${con}' should extend class '${parentConstructor}'`);
            }

            const parentRegistration = this.REGISTERED_NETWORKED_ENTITIES[parentConstructor["SHARED_ID"]];

            vars.push(...parentRegistration.varDefinition, ...this.GetParentSharedEntityVariables(parentRegistration.create));
        }

        return vars;
    },

    init(){
        
        // Order the list, index is SHARED_ID'
        this.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.localeCompare(b.name) );

        //Makes sure I have all shared types registered
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

        //  At this point, all classes have all the correct variables and events registered
        //  This is a second pass making sure inheritance rules are followed;
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

                // If I have a parent class, do the recursive search
                const ALL_VARS = data.varDefinition.concat(...this.GetParentSharedEntityVariables(data.create));
                ALL_VARS.sort((a,b) => a.variablename.localeCompare(b.variablename));

                // console.log(A::)

                this.FINAL_REGISTERED_NETWORKED_ENTITIES.push(
                    {
                        create: data.create,
                        eventDefinition: data.eventDefinition,
                        name: data.name,
                        varDefinition: ALL_VARS,
                    }
                )
            } else {
                this.FINAL_REGISTERED_NETWORKED_ENTITIES.push(data);
            }
        }        
    },

    getEntityClass(sharedID: number): EntityConstructor {
        return this.FINAL_REGISTERED_NETWORKED_ENTITIES[sharedID].create;
    },

    callRemoteEvent(stream: BufferStreamReader, sharedID: number, eventID: number, entity: BaseEntityType){
        

        const eventDefinition = this.FINAL_REGISTERED_NETWORKED_ENTITIES[sharedID].eventDefinition[eventID];

        const args = []
        
        for(const functionArgumentType of eventDefinition.argumenttypes){
            const variable = DeserializeTypedVar(stream, functionArgumentType)
            args.push(variable);
        }

        entity[eventDefinition.methodname](...args);
    },

    readThroughRemoteEventStream(stream: BufferStreamReader, sharedID: number, eventID: number, entity: BaseEntityType){
        const eventDefinition = this.FINAL_REGISTERED_NETWORKED_ENTITIES[sharedID].eventDefinition[eventID];
        
        for(const functionArgumentType of eventDefinition.argumenttypes){
            DeserializeTypedVar(stream, functionArgumentType)
        }
    },

    deserialize(stream: BufferStreamReader, frame: number, sharedID: number, entity: BaseEntityType){
        
        const dirty_bits = stream.getUint32();

        if(dirty_bits & 1){
            // What about interpolation... whoops forgot about that
            DeserializeVec2(stream, "float", new Vec2());
        }

        const variableslist = this.FINAL_REGISTERED_NETWORKED_ENTITIES[sharedID].varDefinition
        
        for(let i = 1; i < variableslist.length + 1; i++){
            if((dirty_bits & (1 << i)) !== 0) {

                
                const variableinfo = variableslist[i - 1];
                // console.log("DIRTY: " + variableinfo.variablename);
                
                const value = DeserializeTypedVar(stream, variableinfo.variabletype);

                if(variableinfo.interpolated){
                    (entity["__" + variableinfo.variablename + "__BUFFER_"] as InterpolatedVarType<any>).buffer.addValue(frame, value); 
                    //console.log(value);
                } else {
                    entity[variableinfo.variablename] = value
                }
    
    
                if(variableinfo.recieveFuncName !== null){
                    entity[variableinfo.recieveFuncName](value);
                }
            }
        }

        // for(const variableinfo of variableslist){
        //     const value = DeserializeTypedVar(stream, variableinfo.variabletype);

        //     if(variableinfo.interpolated){
        //         (entity[variableinfo.variablename] as InterpolatedVarType<any>).buffer.addValue(frame, value); 
        //     } else {
        //         entity[variableinfo.variablename] = value
        //     }


        //     if(variableinfo.recieveFuncName !== null){
        //         entity[variableinfo.recieveFuncName](value);
        //     }
        // }
    }
}



