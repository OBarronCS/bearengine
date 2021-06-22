import { DeserializeTypedNumber, SharedNetworkedEntity, NetworkedNumberTypes, AllNetworkedVariables, SharedEntityLinker, SharedNetworkedEntityDefinitions, AllNetworkedVariablesWithTypes } from "shared/core/sharedlogic/networkschemas";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { floor, ceil, lerp } from "shared/misc/mathutils";
import { RemoteEntity } from "./remotecontrol";


type RegisterVariablesList = {
    variablename: AllNetworkedVariables,
    recieveFuncName: null | string;

    interpolated: boolean
}[];

type NetworkedVariablesList = {
    variablename: AllNetworkedVariables,
    recieveFuncName: null | string;

    interpolated: boolean,

    variabletype: NetworkedNumberTypes,
}[];


type EntityType = RemoteEntity;
type EntityClassType = typeof RemoteEntity;

interface InterpolatedVarType<T> {
    value: T,
    data: InterpVariableData<number>
}

export function InterpolatedVar<T>(value: T): InterpolatedVarType<T> {
    return {
        value: value,
        data: new InterpVariableData<number>()
    }
}

class InterpVariableData<T extends number = number> {

    private values = new Map<number, T>();

    addValue(frame: number, value: T){
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


// Variable decorator
export function interpolatedvariable<T extends EntityType, K extends AllNetworkedVariables>(varName: K, receiveFunc: (this: T, value: AllNetworkedVariablesWithTypes[K]) => void = undefined){
    
    // Property decorator

    return function<T extends EntityType & Record<K, InterpolatedVarType<number>>>(target: T, propertyKey: K){        

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

/** Means a variable is being controlled by the server. Should be readonly on clientside */
// Typescript type inference is unable to detect the T at this point unfortunately, but works in inner function
export function remotevariable<T extends EntityType, K extends AllNetworkedVariables>(varName: K, receiveFunc: (this: T, value: AllNetworkedVariablesWithTypes[K]) => void = undefined){

    // Property decorator
    return function<T extends EntityType & Record<K, number>>(target: T, propertyKey: K){        

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
            interpolated: false,
        });
    }
}

export function networkedclass_client<T extends keyof SharedNetworkedEntity>(classname: T) {

    return function<U extends EntityClassType>(targetConstructor: U){

        targetConstructor["SHARED_ID"] = -1;

        // Validates that it has all the correct variables

        // || returns the right side if left side is null or undefined
        const registeredVariables = targetConstructor["NETWORKED_VARIABLE_REGISTRY"] as RegisterVariablesList || [];
        
        const orderedVariables =  registeredVariables.sort( (a,b) => a.variablename.localeCompare(b.variablename) );

        const orderedVariablesWithType: NetworkedVariablesList = orderedVariables.map( (a) => ({...a,
            variabletype : SharedNetworkedEntityDefinitions[classname]["variables"][a.variablename] as NetworkedNumberTypes,
        }));

        SharedEntityLinker.validateVariables(classname, orderedVariables.map(a => a.variablename));

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




type EntityConstructor = abstract new(...args:any[]) => EntityType;

export const SharedEntityClientTable = {

    // This is a list of all the registered classes, registered using the '@networkedclass_client' decorator
    REGISTERED_NETWORKED_ENTITIES: [] as {
        create: EntityConstructor, 
        name: keyof SharedNetworkedEntity,
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


    deserialize(stream: BufferStreamReader, frame: number, sharedID: number, entity: EntityType){
        
        const variableslist = this.REGISTERED_NETWORKED_ENTITIES[sharedID].varDefinition

        for(const variableinfo of variableslist){
            const value = DeserializeTypedNumber(stream, variableinfo.variabletype);

            if(variableinfo.interpolated){
                entity[variableinfo.variablename].data.addValue(frame, value); 
            } else {
                entity[variableinfo.variablename] = value
            }


            if(variableinfo.recieveFuncName !== null){
                entity[variableinfo.recieveFuncName](value);
            }
        }

    }
}


