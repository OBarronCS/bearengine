

interface EventDefinition {
    // [key: string] : {
    //     register_args: {
    //         [key: string]: any
    //     },
    //     callback: (...args: any[]) => any,
    // },
    [key: string]: (...args: any[]) => any;
}

// Direct events
// Directly from the object to . 
//      Without the object, there cannot be listeners.
// Responsible for one event group
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


