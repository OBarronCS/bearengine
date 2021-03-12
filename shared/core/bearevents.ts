import { AbstractEntity } from "shared/core/abstractentity";
import { BearEvents } from "./sharedlogic/eventdefinitions";

// Responsible for a single event type, use as member variable of a subsystem
export class EventRegistry<EventName extends keyof BearEvents> {

    public eventName: EventName;

    public listeners: {
        entity: AbstractEntity,
        methodname: string,
        extradata: BearEvents[EventName]["register_args"]
    }[] = [];

    [Symbol.iterator](): Iterator<EventRegistry<EventName>["listeners"][number]> {
        return this.listeners[Symbol.iterator]();
    }

    constructor(name: EventName){
        this.eventName = name;
    }

    addListener<T extends AbstractEntity>(entity: T, methodname: keyof T/* MethodsOfClass<T> */, extradata: BearEvents[EventName]["register_args"]){
        this.listeners.push({
            entity,
            //@ts-expect-error --> methodname COULD be symbol or number so it complains
            methodname,
            extradata
        });
    }

    dispatch(listener: EventRegistry<EventName>["listeners"][number], ...args: Parameters<BearEvents[EventName]["callback"]>){        
        listener.entity[listener.methodname](...args);
    }

    all(...args: Parameters<BearEvents[EventName]["callback"]>){
        // have to test that this works first 
        for(const listener of this.listeners){
            listener.entity[listener.methodname](...args);
        }
    }
}



export type EntityEventListType<T extends AbstractEntity> = {
    eventname: keyof BearEvents,
    methodname: keyof T,
    extradata: {};
}[]

// Event registering with decorators
export function bearevent<T extends keyof BearEvents>(eventname: T, extradata: BearEvents[T]["register_args"]) {

    return function<ClassType extends AbstractEntity>(target: ClassType, propertyKey: keyof ClassType /* MethodsOfClass<ClassType> */, descriptor: TypedPropertyDescriptor<BearEvents[T]["callback"]>){
        // Now I can use this propertyKey to attach the event handler

        const constructorClass = target.constructor;
        
        if(constructorClass["EVENT_REGISTRY"] === undefined){
            constructorClass["EVENT_REGISTRY"] = [];
        }
        const eventlist = constructorClass["EVENT_REGISTRY"] as EntityEventListType<ClassType>;
        eventlist.push({
            eventname: eventname,
            methodname: propertyKey,
            extradata: extradata
        });

        console.log(`Added event, ${eventname}, to ${target.constructor.name}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
    }
}


// Takes all methods from a class that have string identifiers
type PickMethods<Base> = Pick<Base, {
    [Key in keyof Base]: Key extends string ? 
        Base[Key] extends Function ? Key : never 
            : never
}[keyof Base]>;

type MethodsOfClass<Class> = keyof PickMethods<Class>


// {
//     2) Option 2 MAYBE: 
//         Special decorators for specific events?  
//         @collisionevent("type",[list of other CollisionPart tags to check or something like that]);
//         Make a decorator factory factory in this case to simplify the creation 
//     }

