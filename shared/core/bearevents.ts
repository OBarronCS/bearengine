

import { AbstractEntity } from "shared/core/abstractentity";
import { ColliderPart } from "shared/core/abstractpart";
import { Vec2 } from "shared/shapes/vec2";


/*
    DONE) Add the event name and method string to a list on target.constuctor (first check if exists, if not, create)
    
    TODO) when "add" an instance of this object to the game, check this static property of the constructor,
    and iterate all event names and strings, and attach them to the correct event emitters


    1) When systems are 'init'ed, it grabs these EventRegistryHandlers, and gives it to the central event repo,
        which has a Map<EventName, Handler>(); Like my original idea for network packet handling.
        This should only be added to during init, then be set in stone.


        When listeners are registered, it takes the event name, finds the handler, and passes the info to it.
    
        FOR NOW:
        What about implicit getting of the entities ColliderPart? 
            Just have the handler use the entity to deal with this implicitely?
           
        WORRY ABOUT THIS LATER, WHEN WANT TO EXPAND EVENTS OUTSIDE OF SYSTEMS:
            Or make it more explicitly handed, in which case the work must be done at Entity init
                needs to grab it and put it into the right parameter. Yeah, not likely. 


  
        // EventRegistry is a member variable of the systems
        The registry holds the data to be able to distribute callbacks to the right methods (objects, method name, additional data for events if needed)
        - O(1) access by class name, data.
        The system itself needs to implement filtering. 


        On init, all systems give their EventRegistry's, specifying its event name, to the central distributor.

        Registering step for collision with other entity:
        1) Decorator on method (specifies EventName):
        2) Entity added to world, check static list of [eventname, methodname, additional data]
        3) Data is passed to EventRegistry which holds it 
        EventRegistry lives on the System . . . 

        To emit collision data:
        1) CollisionSystem, as it moves things, is adding objects to a set of collisions
        2) For each one, see if there is match in the EventRegistry. If so, calls callback immediately.

        Ex. no 2. mouse tap event
        1) Decotoer, @bearevent("tap")
        2) Entity added to world, checks it's static list
        3) instance, method, given to Eventregistry associated with "tap",
        
        to emit: 
        1) Some system that has init the "tap" handler polls for mouse click
        2) if so, find any entity below mouse
        3) If find one, check if it exists in the registry, then call the event 

*/
// interface CoreEventTypeDefinition {
//     [key: string] : {
//         register_args: {
//             [key: string]: any
//         },
//         callback: (...args: any[]) => any,
//     },
// }

export interface BearEvents { // Doing this breaks keyof GameEvents... :( // extends CoreEventTypeDefinition {
    "mousedown": { 
        register_args: {
            
        },
        callback: (mousePoint: Vec2) => void,
    },
    "collision": { 
        register_args: {
            collider: ColliderPart
        },
        callback: (other: AbstractEntity, worldPoint: Vec2) => void,
    },
    "test": { 
        register_args: {
            collider: ColliderPart
        },
        callback: (other: AbstractEntity, worldPoint: Vec2) => void,
    }
}

type test2 = keyof BearEvents

// Is responsible for a single event type. Is a member variable of systems
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

    addListener<T extends AbstractEntity>(entity: T, methodname: MethodsOfClass<T>, extradata: BearEvents[EventName]["register_args"]){
        this.listeners.push({
            entity,
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

const test = new EventRegistry("collision");


export type EntityEventListType = {
    eventname: keyof BearEvents,
    methodname: string,
    extradata: {};
}[]

// Event registering with decorators
export function bearevent<T extends keyof BearEvents>(eventname: T, extradata: BearEvents[T]["register_args"]) {

    return function<ClassType extends AbstractEntity>(target: ClassType, propertyKey: MethodsOfClass<ClassType>, descriptor: TypedPropertyDescriptor<BearEvents[T]["callback"]>){
        // Now I can use this propertyKey to attach the event handler

        const constructorClass = target.constructor;
        
        if(constructorClass["EVENT_REGISTRY"] === undefined){
            constructorClass["EVENT_REGISTRY"] = [];
        }
        const eventlist = constructorClass["EVENT_REGISTRY"] as EntityEventListType;
        eventlist.push({
            eventname: eventname,
            methodname: propertyKey,
            extradata: extradata
        });

        console.log(`Added event, ${eventlist}`)
        console.log(`Added event, ${eventname}, to ${target.constructor.name}`)
        console.log(target.constructor)
        console.log(propertyKey);
    }
}

// Example use:
// class Test extends AbstractEntity {
//     update(dt: number): void {}

//     @bearevent("mousedown", {collider:this})
//     onMouseDown(num: number, test: string) {}
// }



// Takes all methods from a class that have string identifiers
type PickMethods<Base> = Pick<Base, {
    [Key in keyof Base]: Key extends string ? 
        Base[Key] extends Function ? Key : never 
            : never
}[keyof Base]>;

type MethodsOfClass<Class> = keyof PickMethods<Class>


// {
//     2) Option 2 MAYBE: 
//         Special decorators for domain specific events?  
//         @collisionevent("type",[list of other CollisionPart tags to check or something like that]);

//         Make a decorator factory factory in this case to simplify the creation 
//     }

