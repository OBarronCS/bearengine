import { AbstractEntity } from "shared/core/abstractentity";
import { getEntityIndex } from "./scene";
import { BearEvents } from "./sharedlogic/eventdefinitions";

// Responsible for a single event type, use as member variable of a subsystem
export class EventRegistry<EventName extends keyof BearEvents> {

    public eventName: EventName;

    public eventSparseSet: EventContainer<EventName> = new EventContainer();

    [Symbol.iterator](): Iterator<EventContainer<EventName>["dense"][number]> {
        return this.eventSparseSet.dense[Symbol.iterator]();
    }

    constructor(name: EventName){
        this.eventName = name;
    }

    addListener<T extends AbstractEntity>(entity: T, methodname: keyof T/* MethodsOfClass<T> */, extradata: BearEvents[EventName]["register_args"], sparseIndex: number){
        this.eventSparseSet.addEntity({
            entity,
            //@ts-expect-error --> methodname COULD be symbol or number so it complains
            methodname,
            extradata
        }, sparseIndex)
    }

    removeListener(sparseIndex: number){
        this.eventSparseSet.removeEntity(sparseIndex);
    }

    dispatch(listener: EventContainer<EventName>["dense"][number], ...args: Parameters<BearEvents[EventName]["callback"]>){        
        listener.entity[listener.methodname](...args);
    }

    all(...args: Parameters<BearEvents[EventName]["callback"]>){
        // have to test that this works first 
        for(const listener of this.eventSparseSet.dense){
            listener.entity[listener.methodname](...args);
        }
    }

    toString(): string {
        return this.eventSparseSet.toString();
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

        // console.log(constructorClass);
    
        // Deals with inheriting super class events
        if(!constructorClass.hasOwnProperty("EVENT_REGISTRY")){

            let parentEvents = [];
            if(constructorClass["EVENT_REGISTRY"] !== undefined){
                parentEvents.push(...constructorClass["EVENT_REGISTRY"]);
            }

            constructorClass["EVENT_REGISTRY"] = [...parentEvents];
        }
        

        const eventlist = constructorClass["EVENT_REGISTRY"] as EntityEventListType<ClassType>;

        //Make sure only one of this event type has been added to this entity
        if(eventlist.some((a) =>a.eventname === eventname)){
            throw new Error("Cannot have multiple methods assoicated with the same event: " + eventname);
        }

        eventlist.push({
            eventname: eventname,
            methodname: propertyKey,
            extradata: extradata
        });

        // console.log(`Added event, ${eventname}, to ${target.constructor.name}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
    }
}


// Picks properties that are methods with string identifiers
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



// EVENT CONTAINERS

class EventContainer<EventName extends keyof BearEvents> {

    // onAdd: ((part: T) => void)[] = [];
    // onRemove: ((part: T) => void)[] = [];

    public sparse: number[]= [];
    public dense: {
        entity: AbstractEntity,
        methodname: string,
        extradata: BearEvents[EventName]["register_args"]
    }[] = []

    

    addEntity(data: EventContainer<EventName>["dense"][number], sparseIndex: number){
        const indexInDense = this.dense.push(data) - 1;
        this.sparse[sparseIndex] = indexInDense;

        // for(const onAdd of this.onAdd){
        //     onAdd(part);
        // }
    }

    /** Remove entity at this sparse index. */
    removeEntity(sparseIndex: number){
        const denseIndex = this.sparse[sparseIndex];

        // Set the sparse to -1 to signify it's not here
        this.sparse[sparseIndex] = -1;
        
        // Edge case: removing the last part in the list.
        const lastIndex = this.dense.length - 1;
        if(denseIndex !== lastIndex){
            // swap this with last entity in dense
            this.dense[denseIndex] = this.dense[lastIndex];

            const swappedID = getEntityIndex(this.dense[denseIndex].entity.entityID);
            this.sparse[swappedID] = denseIndex;
        }

        this.dense.pop();

        // for(const onRemove of this.onRemove){
        //     onRemove(part);
        // }
    }

    toString(): string {
        let str = "";

        for(const val of this.dense){
            str += "" + val.entity.entityID;
        }

        return str;
    }
}









