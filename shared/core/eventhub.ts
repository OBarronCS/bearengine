

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
class EventHub<T extends EventDefinition> {

    private listeners: EventGroup<T>[] = [];

    //listener: EventContainer<EventName>["dense"][number],
    dispatch<E extends keyof T>(event: E,  ...args: Parameters<T[E]>){
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


type T = {
    on_clear: () => void
    on_add: (terrain_mesh) => void
    on_remove: (terrain_mesh) => void
    on_mutate: (terrain_mesh) => void
    on_hit: (terrain_mesh) => void
}

const t = new EventHub<T>();

t.add_handler({
    on_add: () => 0,
    on_clear: () => 0,
    on_hit: () => 0,
    on_mutate: () => 0,
    on_remove: () => 0,
})

t.dispatch("on_hit", 1)


/**
 * Server says number 7 was hit;
 * TerrainManager has SparseSet of TerrainMeshes'
 *      Gets the one with id 7.
 * 
 *      call this.terrain_mesh_events.call("on_hit", get(7));
 *          this.will call all handlesr, which 
 * 
 * 
 *  TerrainMeshEventHandler
 * 
 * 
 * 
 * How to delete with deletion, mutation of terrain break events.
 * 
 * 
 * 
 *  

    
TODO:
    Make polygon cache results, like of area, and AABB. What about if mutate? Hide the "points" as private?

    SpatialGrid
        --> Store query_id, and cache AABB --> contract that WILL NOT MUTATE objects.
            --> AABB recalculated on insert
            {
                query_id: number,
                cached_aabb: AABB,
                value: T
            }

    Add polygon carving straight to polygons, becuase right now there is a bug where some points are new, but some are from the
        original object, so they contain reference to the same Vec2 objects.
        
        Make the whole operations immutable
            So the current polygon is NOT changed at all

            Returns all the new polygons that this carve creates:
            
            Edge conditions:
                Doesn't touch at all: return array with just self-copy[] --> will create a BUNCH of copies, annoying
                Completely touches: return empty array?

            Better for performance
            OR: return a union {type:"total"} --> indicates entire polygon was broken
                               {type:"missed"} -> indicates didn't touch
                               {type:"normal", arr: Polygon[]} -> indicates was touched

            TerrainManager will do the call, if "missed", do nothing
                                             if "total", will remove it from data structure, // Remember, immutable.
                                             if "normal", removes original, and inserts all new ones


        maybe make an inplace version too.
            Could result in invalid state, tho, if the whole thing is destroyed


 * 
 */

