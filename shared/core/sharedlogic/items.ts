import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { Vec2 } from "shared/shapes/vec2";
import { SharedNetworkedEntities } from "./networkschemas";
import { DefineSchema, TypescriptTypeOfNetVar } from "./serialization";
import { SimpleWeaponControllerDefinition } from "./weapondefinitions";


// Here is type to use to set data for instances of items
//@ts-expect-error
type Test<T extends keyof SharedNetworkedEntities> = {type: T} & { [ K in keyof SharedNetworkedEntities[T]["variables"] ] : TypescriptTypeOfNetVar<SharedNetworkedEntities[T]["variables"][K]> };

// This model means that everything that is defined in shared data must be defined for everysingle item of that type
// And that data is always shared. shit.
// Shared static data lives in the definition here. Can be accessed here. Is global, static data.
// Classes just need to know to access it here when needed
// NOPE not that simple
// Each type will have its own section of static data, i need to enforce that every "weapon" type has dmg count. How do I enforce this in this definition
// fuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuck. Test<"bullet">. Should the shared definition have a static section as well? 
/**  type can just be a normal type, not something crazy
 * 
 *  Can they also have default values? This is transrom into the following type: DefaultValue<number>(0);
 * static_vars:{
 *       name: 0
 * }
 * 
 * Uses:
 *  shared static variables defined in one place, like things that don't change.
 *  Provides types and names for static vars, so outside systems, like items, can access their types and change them for a certain instance
 * 
 *  So shared entity defines types for classes. 
 *  static vars also don't need to be synced constantly, so can know to send them only once if they depend per instance
 *    Pre mature optimization?
 * 
 * Static data needs to be inherited
 * 
 * Maybe this points to the fact that I need to generalize this structure of shared data. Use idea of static_vars for now
 * */
// Also need to have additional data that is specific to only one weapon for exmaple.
// Add [k:string]: any

const h: Test<"bullet"> = {
    type:"bullet", 
    _pos: new Vec2(),
    test:1,
    // hello: 1
};


export enum ItemType {
    SIMPLE, // Items that you just need to check for the presence of, have no logic; ect: gold
    TERRAIN_CARVER,
    HITSCAN_WEAPON,
}


export interface ItemData {
    item_type: ItemType,
    item_name: string,
    item_id: number;
    item_sprite: string,
}


export interface SimpleItemData extends ItemData {
    item_type: ItemType.SIMPLE,
}

export interface GunItemData extends ItemData {
    item_type: ItemType.TERRAIN_CARVER | ItemType.HITSCAN_WEAPON,
    shoot_controller: SimpleWeaponControllerDefinition,
    capacity: number,
    reload_time: number,
    ammo: number
}




type toOmit = "item_id" | "item_name";

type ALL_ITEM_TYPES = Omit<GunItemData,toOmit> | Omit<SimpleItemData, toOmit>;



const ITEM_DEFINITIONS = DefineSchema< { [K: string]: ALL_ITEM_TYPES } >()({
    terrain_carver: {
        item_type: ItemType.TERRAIN_CARVER,
        item_sprite: "weapon1.png",
        shoot_controller: { type: "auto", time_between_shots: 15 },
        capacity: 10,
        ammo: 100,
        reload_time: 12,
    },
    first_hitscan: {
        item_type: ItemType.HITSCAN_WEAPON,
        item_sprite: "weapon1.png",
        ammo: 1000,
        capacity: 10,
        reload_time: 10,
        shoot_controller: { type: "auto", time_between_shots: 6 },
    },

} as const);

export function SerializeItemData(stream: BufferStreamWriter, item: ALL_ITEM_TYPES & ItemData): void {

    stream.setUint8(item.item_id);

    switch(item.item_type){
        case ItemType.SIMPLE: {
            
            break;
        }
        case ItemType.HITSCAN_WEAPON:
        case ItemType.TERRAIN_CARVER: {
            stream.setUint16(item.ammo);

            break;
        }

        default: AssertUnreachable(item);
    }
}

export function DeserializeItemData(stream: BufferStreamReader, targetItem: ALL_ITEM_TYPES){
    
    const type: ItemType = stream.getUint8();

    switch(type){
        case ItemType.SIMPLE: {
            
            break;
        }
        case ItemType.HITSCAN_WEAPON:
        case ItemType.TERRAIN_CARVER: {
            targetItem["ammo"] = stream.getUint16();
            
            break;
        }

        default: AssertUnreachable(type);
    }
}


const idToNameMap: Map<number, keyof typeof ITEM_DEFINITIONS> = new Map();
const nameToIdMap: Map< keyof typeof ITEM_DEFINITIONS, number> = new Map();

export const ALL_ITEMS = (function(){
    const shared_item_names = Object.keys(ITEM_DEFINITIONS).sort();

    let max_id:number = 0;

    const items: {[key in keyof typeof ITEM_DEFINITIONS]: typeof ITEM_DEFINITIONS[key] & ItemData } = {} as any;

    for(const name of shared_item_names){
        const item_name = name;
        const item_id = max_id++;
        items[name] = {...ITEM_DEFINITIONS[name], item_id, item_name};

        //@ts-expect-error
        idToNameMap.set(item_id, name);
        //@ts-expect-error
        nameToIdMap.set(name, item_id);
    }

    return items;
})();

// Assigns ID's to all the items
export const ITEM_LINKER = {
    IDToName(id: number){
        return idToNameMap.get(id);
    },
    NameToID(name: keyof typeof ITEM_DEFINITIONS){
        return nameToIdMap.get(name);
    }
}

export function CreateItemDataFromID(item_id: number){
    return CreateItemData(ITEM_LINKER.IDToName(item_id));
}

/** Returns a clone of the item template */
export function CreateItemData<T extends keyof typeof ALL_ITEMS>(item_name: T){
    return {...ALL_ITEMS[item_name]};
}

