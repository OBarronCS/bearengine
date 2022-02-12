
import type { AbstractEntity } from "shared/core/abstractentity";
import type { Vec2 } from "shared/shapes/vec2";
import type { Attribute } from "./entityattribute";
import type { MouseButton } from "client/src/app/input/mouse";
import { SparseSet } from "shared/datastructures/sparseset";



export type EntityEventRegistrationType = {
    event_name: keyof typeof bearevents,
    method_name: string,
    extradata: RegistrationArgs<keyof typeof bearevents>;
}

export const bearevents = {
    mouse_down: <T extends MouseButton>(button: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(mouse_point: Vec2) => void>){
            register_entity_event("mouse_down", key, target.constructor as typeof AbstractEntity, button)
        };
    },
    collision: <T extends typeof Attribute>(other_type: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(other: T) => void>){
            register_entity_event("collision", key, target.constructor as typeof AbstractEntity, other_type)
        };
    }
} as const;


type RegistrationArgs<T extends keyof typeof bearevents> = Parameters<(typeof bearevents)[T]>;
type CallbackType<T extends keyof typeof bearevents> = Parameters<ReturnType<(typeof bearevents)[T]>>[2] extends TypedPropertyDescriptor<infer R> ? R : never;



function register_entity_event<E extends keyof typeof bearevents,U extends typeof AbstractEntity>(event_name: E, method_name: string, ctor: U, ...register_args: RegistrationArgs<E>){
    // console.log(constructorClass);
    
        // Deals with inheriting super class events
        if(!ctor.hasOwnProperty("EVENT_REGISTRY")){

            let parentEvents = [];
            if(ctor["EVENT_REGISTRY"] !== undefined){
                parentEvents.push(...ctor["EVENT_REGISTRY"]);
            }

            ctor["EVENT_REGISTRY"] = [...parentEvents];
        }
        

        const eventlist = ctor["EVENT_REGISTRY"] as EntityEventRegistrationType[];

        //Make sure only one of this event type has been added to this entity
        if(eventlist.some((a) => a.event_name === event_name)){
            throw new Error("Cannot have multiple methods assoicated with the same event: " + event_name);
        }

        eventlist.push({
            event_name,
            method_name,
            extradata: register_args
        });

        // console.log(`Added event, ${eventname}, to ${target.constructor.name}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
}


type h = RegistrationArgs<"mouse_down">;
type test = CallbackType<"mouse_down">

export interface EventDispatcherType<E extends keyof typeof bearevents> {
    addListener<T extends AbstractEntity>(sparse_index: number, entity: T, method_name: string, ...extradata: RegistrationArgs<E>): void;
    removeListener(sparse_index: number): void;
    event_name: keyof typeof bearevents;
}

/** Simply adds all entities to a sparse set */
export class SimpleEventDispatcher<E extends keyof typeof bearevents> implements EventDispatcherType<E>{
    
    readonly event_name: keyof typeof bearevents;

    private sparseset = new SparseSet<{
        entity: AbstractEntity,
        method_name: string,
        extradata: RegistrationArgs<E>
    }>();

    constructor(name: E){
        this.event_name = name;
    }

    [Symbol.iterator](){
        return this.sparseset.values()[Symbol.iterator]();
    }

    addListener<T extends AbstractEntity>(sparse_index: number, entity: T, method_name: string, ...extradata: RegistrationArgs<E>){
        this.sparseset.set(sparse_index, {
            entity,
            method_name,
            extradata
        })
    }

    removeListener(sparse_index: number){
        this.sparseset.remove(sparse_index);
    }
    
    //@ts-expect-error  // it yes but it works 
    dispatch(listener: SimpleEventDispatcher<E>["sparseset"]["dense"][number], ...args: Parameters<CallbackType<E>>){        
        listener.entity[listener.method_name](...args);
    }

    //@ts-expect-error  // it yes but it works 
    all(...args: Parameters<CallbackType<E>>){
        // have to test that this works first 
        for(const listener of this.sparseset.values()){
            listener.entity[listener.method_name](...args);
        }
    }
}

// const test99 = new SimpleEventDispatcher("mouse_down");





// // Event registering with decorators
// export function bearevent<T extends keyof BearEvents>(eventname: T, extradata: BearEvents[T]["register_args"]) {

//     return function<ClassType extends AbstractEntity>(target: ClassType, propertyKey: keyof ClassType /* MethodsOfClass<ClassType> */, descriptor: TypedPropertyDescriptor<BearEvents[T]["callback"]>){
//         // Now I can use this propertyKey to attach the event handler

//         const constructorClass = target.constructor;

//         // console.log(constructorClass);
    
//         // Deals with inheriting super class events
//         if(!constructorClass.hasOwnProperty("EVENT_REGISTRY")){

//             let parentEvents = [];
//             if(constructorClass["EVENT_REGISTRY"] !== undefined){
//                 parentEvents.push(...constructorClass["EVENT_REGISTRY"]);
//             }

//             constructorClass["EVENT_REGISTRY"] = [...parentEvents];
//         }
        

//         const eventlist = constructorClass["EVENT_REGISTRY"] as EntityEventListType<ClassType>;

//         //Make sure only one of this event type has been added to this entity
//         if(eventlist.some((a) =>a.eventname === eventname)){
//             throw new Error("Cannot have multiple methods assoicated with the same event: " + eventname);
//         }

//         eventlist.push({
//             eventname: eventname,
//             methodname: propertyKey,
//             extradata: extradata
//         });

//         // console.log(`Added event, ${eventname}, to ${target.constructor.name}, linked to method with name ${propertyKey}`)
//         //console.log(target.constructor)
//     }
// }



// Responsible for a single entity event type, use as member variable of a subsystem
// export class EventRegistry<EventName extends keyof BearEvents> {

//     public eventName: EventName;


//     //public sparseset = new SparseSet();
//     // public _sparseSet = new SparseSet

//     public eventSparseSet: EventContainer<EventName> = new EventContainer();

//     [Symbol.iterator](): Iterator<EventContainer<EventName>["dense"][number]> {
//         return this.eventSparseSet.dense[Symbol.iterator]();
//     }

//     constructor(name: EventName){
//         this.eventName = name;
//     }

//     addListener<T extends AbstractEntity>(entity: T, methodname: keyof T/* MethodsOfClass<T> */, extradata: BearEvents[EventName]["register_args"], sparseIndex: number){
//         this.eventSparseSet.addEntity({
//             entity,
//             //@ts-expect-error --> methodname COULD be symbol or number so it complains
//             methodname,
//             extradata
//         }, sparseIndex)
//     }

//     removeListener(sparseIndex: number){
//         this.eventSparseSet.removeEntity(sparseIndex);
//     }

//     dispatch(listener: EventContainer<EventName>["dense"][number], ...args: Parameters<BearEvents[EventName]["callback"]>){        
//         listener.entity[listener.methodname](...args);
//     }

//     all(...args: Parameters<BearEvents[EventName]["callback"]>){
//         // have to test that this works first 
//         for(const listener of this.eventSparseSet.dense){
//             listener.entity[listener.methodname](...args);
//         }
//     }

//     toString(): string {
//         return this.eventSparseSet.toString();
//     }
// }


/** Contains all the entities that are listening to a certain event. 
 *  Dispatches these events
 */
// class EventContainer<EventName extends keyof BearEvents> {

//     // onAdd: ((part: T) => void)[] = [];
//     // onRemove: ((part: T) => void)[] = [];

//     public sparse: number[]= [];
//     public dense: {
//         entity: AbstractEntity,
//         methodname: string,
//         extradata: BearEvents[EventName]["register_args"]
//     }[] = []

    

//     addEntity(data: EventContainer<EventName>["dense"][number], sparseIndex: number){
//         const indexInDense = this.dense.push(data) - 1;
//         this.sparse[sparseIndex] = indexInDense;

//         // for(const onAdd of this.onAdd){
//         //     onAdd(part);
//         // }
//     }

//     /** Remove entity at this sparse index. */
//     removeEntity(sparseIndex: number){
//         const denseIndex = this.sparse[sparseIndex];

//         // Set the sparse to -1 to signify it's not here
//         this.sparse[sparseIndex] = -1;
        
//         // Edge case: removing the last part in the list.
//         const lastIndex = this.dense.length - 1;
//         if(denseIndex !== lastIndex){
//             // swap this with last entity in dense
//             this.dense[denseIndex] = this.dense[lastIndex];

//             const swappedID = getEntityIndex(this.dense[denseIndex].entity.entityID);
//             this.sparse[swappedID] = denseIndex;
//         }

//         this.dense.pop();

//         // for(const onRemove of this.onRemove){
//         //     onRemove(part);
//         // }
//     }

//     toString(): string {
//         let str = "";

//         for(const val of this.dense){
//             str += "" + val.entity.entityID;
//         }

//         return str;
//     }
// }









