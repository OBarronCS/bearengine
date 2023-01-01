
import type { AbstractEntity } from "shared/core/abstractentity";
import type { Vec2 } from "shared/shapes/vec2";
import type { Attribute, AttributeCtor } from "./entityattribute";
import type { MouseButton } from "client/src/app/input/mouse";
import { SparseSet } from "shared/datastructures/sparseset";



export const bearevents = {
    mouse_down: <T extends MouseButton>(button: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(mouse_point: Vec2) => void>){
            register_entity_event("mouse_down", key, target.constructor as typeof AbstractEntity, button)
        };
    },
    collision: <T extends AttributeCtor>(other_type: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(other: InstanceType<T>) => void>){
            register_entity_event("collision", key, target.constructor as typeof AbstractEntity, other_type)
        };
    },
    collision_start: <T extends AttributeCtor>(other_type: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(other: InstanceType<T>) => void>){
            register_entity_event("collision_start", key, target.constructor as typeof AbstractEntity, other_type)
        };
    },
    collision_end: <T extends AttributeCtor>(other_type: T) => {
        return function<C extends AbstractEntity>(target: C, key: string, r: TypedPropertyDescriptor<(other: InstanceType<T>) => void>){
            register_entity_event("collision_end", key, target.constructor as typeof AbstractEntity, other_type)
        };
    }
} as const;

/** OLD EVENTS
 * 
 * "mousehover": {
        register_args: {};
        callback: (mousePoint: Vec2) => void;
    };
    "tap": {
        register_args: {};
        callback: (mousePoint: Vec2) => void;
    };
    "mousedown":{
        register_args: { button: MouseButton };
        callback: (mousePoint: Vec2) => void;
    }
    "scroll":{
        register_args: { };
        callback: (scroll: number, mousePoint: Vec2) => void;
    }

    "postupdate":{
        register_args: { };
        callback: (dt: number) => void;
    }

    "preupdate": {
        register_args: { };
        callback: (dt: number) => void;
    }
 */

export type EntityEventRegistrationType = {
    event_name: keyof typeof bearevents,
    method_name: string,
    extradata: RegistrationArgs<keyof typeof bearevents>;
}

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


type r_args_test = RegistrationArgs<"mouse_down">;
type r_callback_type_test = CallbackType<"mouse_down">

export interface EventDispatcherType<E extends keyof typeof bearevents> {
    addListener<T extends AbstractEntity>(sparse_index: number, entity: T, method_name: string, ...extradata: RegistrationArgs<E>): void;
    removeListener(sparse_index: number): void;
    event_name: keyof typeof bearevents;
}

/** Simply adds all entities to a sparse set */
export class SimpleEventDispatcher<E extends keyof typeof bearevents> implements EventDispatcherType<E> {
    
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

    get_entity_event_data(sparse_index: number){
        return this.sparseset.get(sparse_index);
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
    
    //@ts-expect-error  // it yells but it works 
    dispatch(listener: SimpleEventDispatcher<E>["sparseset"]["dense"][number], ...args: Parameters<CallbackType<E>>){        
        listener.entity[listener.method_name](...args);
    }

    //@ts-expect-error  // it yells but it works 
    all(...args: Parameters<CallbackType<E>>){
        // have to test that this works first 
        for(const listener of this.sparseset.values()){
            listener.entity[listener.method_name](...args);
        }
    }
}

export class CustomEventDispatcher<E extends keyof typeof bearevents> implements EventDispatcherType<E> {
    
    readonly event_name: keyof typeof bearevents;

    private on_add: (sparse_index: number, entity: AbstractEntity, method_name: string, ...extradata: RegistrationArgs<E>) => void;
    private on_remove: (sparse_index: number) => void;

    constructor(name: E, on_add: CustomEventDispatcher<E>["on_add"], on_remove: CustomEventDispatcher<E>["on_remove"]){
        this.event_name = name;
        this.on_add = on_add;
        this.on_remove = on_remove;
    }
    
    addListener<T extends AbstractEntity>(sparse_index: number, entity: T, method_name: string, ...extradata: RegistrationArgs<E>): void {
        this.on_add(sparse_index, entity, method_name, ...extradata);
    }

    removeListener(sparse_index: number): void {
        this.on_remove(sparse_index);
    }
}



