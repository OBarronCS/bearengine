import { SparseSet } from "shared/datastructures/sparseset";


interface EventDefinition {
    // [key: string] : {
    //     register_args: {
    //         [key: string]: any
    //     },
    //     callback: (...args: any[]) => any,
    // },
    [key: string]: (...args: any[]) => any;
}

/** Use when have multiple signals that are related, 
 *  and where the caller must define handlers for ALL of the group at the same time 
 *  
 *  Use as a member variable of a system/entity.
 *  Allows the object to send events directly to listeners.
 * 
 * "Direct events"
 */
export class EventHub<T extends EventDefinition> {

    private listeners: EventGroup<T>[] = [];
    private no_op = false

    //listener: EventContainer<EventName>["dense"][number],
    dispatch<E extends keyof T>(event: E,  ...args: Parameters<T[E]>){
        if(this.no_op) return;
        
        for(const li of this.listeners){
            li.get_callback(event)(...args);
        }
    }
    
    add_handler(callbacks: EventGroupDef<T>){
        this.listeners.push(new EventGroup(callbacks));
    }
}

type EventGroupDef<T extends EventDefinition> = { [K in keyof T]: T[K] };

/** Holds references to callbacks for a connected group of events */
class EventGroup<T extends EventDefinition> {

    private callback_map = new Map<keyof T, T[keyof T]>();

    constructor(callbacks: EventGroupDef<T>){
        for(const key in callbacks){
            this.callback_map.set(key, callbacks[key]);
        }
    }
    
    get_callback<E extends keyof T>(event: E): T[E] {
        return this.callback_map.get(event) as T[E];
    }

    // call_event<E extends keyof T>(event: E, ...args: Parameters<T[E]>){
    //     const callback = this.callback_map.get(event);
    //     callback(...args);
    // }
}


/** EventHub but for a single event. Convenience
*/
export class PureSignal<T extends (...args: any[]) => any>{
    
    private next_handler_id = 0;
    private listeners = new SparseSet<T>();

    private no_op = false

    /** Sends callback to all listeners */
    dispatch(...args: Parameters<T>){
        if(this.no_op) return;

        // Iterate backwards so can remove current handler while iterating.
        const listeners = this.listeners.values();
        for(let i = listeners.length - 1; i >= 0; --i){
            const li = listeners[i];
            li(...args);
        }
    }
    
    add_handler(cb: T): number {
        const id = this.next_handler_id++;
        this.listeners.set(id, cb);
        return id;
    }

    /** 
     * Only remove CURRENT handler inside of a handler callback
     * */
    remove_handler(id: number): void {
        this.listeners.remove(id);
    }
}


interface StatefulEventDefinition {
    register_args: {
        [key: string]: any
    };
    internal_args: {
        [key: string]: any
    }
    callback: (...args: any[]) => any;
}
 
/** Signals with context -> subscribers give extra registration info, 
 *  make the system do work based on arguments and report to signal then 
 * 
 * `Simple` because work is done just by iterating listeners.
 * 
 * Does not dispatch to all listeners at once. Uses state to determine this.
 * 
 */
export class SimpleStatefulSignal<T extends StatefulEventDefinition>{
    
    private next_handler_id = 0;
    private listeners = new SparseSet<T & {handler_id:number}>();
    private no_op = false;

    /** Used to initialize internal args on registration */    
    constructor(
        public on_add_callback: (register_args: T["register_args"]) => T["internal_args"]
        )
    {

    }

    custom_iterator(){
        return this.listeners.custom_iterator();
    }

    // /** Used to iterate all listeners and conditionally dispatch */
    // [Symbol.iterator]() {
    //     return this.listeners.values()[Symbol.iterator]();
    // }

    /** Dispatch to individual listener */
    dispatch(li: T,...args: Parameters<T["callback"]>){
        if(this.no_op) return;
        
        li.callback(...args);
    }
    
    add_handler(args: T["register_args"], cb: T["callback"]): number {
            
        const id = this.next_handler_id++;
                
        this.listeners.set(id,
            //@ts-expect-error -> TypeScript not recognizing that I'm pushing "T" to the array 
            {
            handler_id: id,
            register_args: args,
            internal_args: this.on_add_callback(args),
            callback: cb
        });

        return id;
    }

    /** 
     * If removing current, handlers inside of a callback, use custom_iterator();
    */
    remove_handler(id: number): void {
        this.listeners.remove(id);
    }
}

/** TODO: CustomStatefulSignal. Allows custom on_add and on_delete behavior */




interface IOnDelaySignal {
    register_args: {
        delay: number
    };
    internal_args: {
        ticks_so_far: number
    }
    callback: () => void;
}

/** Functions that run after given tick delay */
export class OnDelaySignal extends SimpleStatefulSignal<IOnDelaySignal> {
    
    constructor(){
        super((args) => ({ticks_so_far: 0}));
    }
    
    update(){

        const it = this.custom_iterator();

        for(const li of it){            
            if(li.internal_args.ticks_so_far++ === li.register_args.delay){
                this.dispatch(li);
                it.remove_current();
            }
        }

    }
}

interface IOnIntervalSignal {
    register_args: {
        delay: number
    };
    internal_args: {
        ticks_so_far: number,
        lap: number
    }
    callback: (lap: number) => void;
}

/** Functions that run on an interval 
 * TODO: Add "max laps" optional argument
*/
export class OnIntervalSignal extends SimpleStatefulSignal<IOnIntervalSignal> {
    
    constructor(){
        super((args) => ({ticks_so_far: 0, lap: 0}));
    }
    
    update(){

        const it = this.custom_iterator();

        for(const li of it){
            if(li.internal_args.ticks_so_far++ % li.register_args.delay === 0){
                this.dispatch(li, li.internal_args.lap++);
                it.remove_current();
            }
        }

    }
}

// const a = new SimpleStatefulSignal<IOnDelaySignal>((args) => ({ticks_so_far: 0}));
// a.add_handler({delay:10}, () => void 0);

// const it = a.custom_iterator();

// for(const f of it){

//     a.dispatch(f);
//     it.remove_current();

// }


