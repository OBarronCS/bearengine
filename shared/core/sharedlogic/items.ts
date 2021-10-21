import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { Vec2 } from "shared/shapes/vec2";
import { SharedNetworkedEntities } from "./networkschemas";
import { DefineSchema, TypescriptTypeOfNetVar } from "./serialization";
import { CreateShootController, SimpleWeaponControllerDefinition } from "./weapondefinitions";

// This model means that everything that is defined in shared data must be defined for everysingle item of that type
// Shared static data lives in the definition here. Can be accessed here. Is global, static data.
// Classes just need to know to access it here when needed
// NOPE not that simple
// Each type will have its own section of static data, i need to enforce that every "weapon" type has dmg count. How do I enforce this in this definition
// Should the shared definition have a static section as well? 
/**  
 * So shared entity defines types for classes. 
 * 
 * Static data needs to be inherited
 * 
 * Maybe this points to the fact that I need to generalize this structure of shared data. Use idea of static_vars for now
 * */
// Also need to have additional data that is specific to only one weapon for exmaple.
// Add [k:string]: any
// Migrating items to new system

export type deep = [1,2,3,4,5,6,7,8,never];

export type SubVars<T extends keyof SharedNetworkedEntities, M extends number> = deep[M] extends never ? {} : { 
    //@ts-expect-error
    [ K in keyof SharedNetworkedEntities[T]["variables"] ] : TypescriptTypeOfNetVar<SharedNetworkedEntities[T]["variables"][K]> 
} & { 
    //@ts-expect-error
    [ K in keyof SharedNetworkedEntities[T]["static"] ] : SharedNetworkedEntities[T]["static"][K] 
} & (SharedNetworkedEntities[T]["extends"] extends null ? {} : SubVars<SharedNetworkedEntities[T]["extends"], deep[M]>);

export type ItemTypeData<T extends keyof SharedNetworkedEntities> = { type: T } & SubVars<T,0>;

export type Test<T extends keyof SharedNetworkedEntities> = CommonItemData & ItemTypeData<T>

// { type: T } & { 
//     //@ts-expect-error
//     [ K in keyof SharedNetworkedEntities[T]["variables"] ] : TypescriptTypeOfNetVar<SharedNetworkedEntities[T]["variables"][K]> 
// } & { 
//     //@ts-expect-error
//     [ K in keyof SharedNetworkedEntities[T]["static"] ] : SharedNetworkedEntities[T]["static"][K] 
// };


// Hack to make typescript autocomplete work for item types
function CreateItem<T extends keyof SharedNetworkedEntities, K extends Test<T>>(i: Test<T>){
    return i;
}
/**
 * Raw item name now extracted from index
 * Item id created automatically
 */

interface CommonItemData {
    item_sprite: string,
    item_name: string // display name
}


// Each of these is assigned a unique ItemID
export const MIGRATED_ITEMS = DefineSchema< {[k: string] : Test<keyof SharedNetworkedEntities>} >()({


    circle_terrain_carver: CreateItem({
        type:"terrain_carver_weapon",
        item_name:"Circle Carver",
        item_sprite:"weapon1.png",
        capacity: 19,
        ammo: 10,
        reload_time: 10,
        shoot_controller: { type:"auto", time_between_shots: 15 }
    }),

    first_hitscan: CreateItem({
        type:"hitscan_weapon",
        item_name:"Simple Hitscan",
        item_sprite:"weapon1.png",
        capacity: 10,
        ammo: 1000,
        reload_time: 10,
        shoot_controller: { type: "auto", time_between_shots: 6 }
    })



} as const);




// Linking objects


const idToNameMap: Map<number, keyof typeof MIGRATED_ITEMS> = new Map();
const nameToIdMap: Map<keyof typeof MIGRATED_ITEMS, number> = new Map();

// Allows for items to be linked across the network

//export const ALL_ITEMS = 
(function(){
    const shared_item_names = Object.keys(MIGRATED_ITEMS).sort() as (keyof typeof MIGRATED_ITEMS)[];

    let max_id: number = 0;

    // const items: {[key in keyof typeof MIGRATED_ITEMS]: typeof MIGRATED_ITEMS[key]} = {} as any;

    for(const name of shared_item_names){
        // const item_name = name;
        const item_id = max_id++;
        // items[name] = {...ITEM_DEFINITIONS[name], item_id, item_name};

        idToNameMap.set(item_id, name);
        nameToIdMap.set(name, item_id);
    }

    //return items;
})();

// Assigns ID's to all the items
export const ITEM_LINKER = {
    ItemData(id: number){
        return MIGRATED_ITEMS[this.IDToName(id)];
    },
    IDToName(id: number){
        return idToNameMap.get(id);
    },
    NameToID(name: keyof typeof MIGRATED_ITEMS){
        return nameToIdMap.get(name);
    }
}


























// OLD STUFF BELOW



// export enum ItemType {
//     SIMPLE, // Items that you just need to check for the presence of, have no logic; ect: gold
//     TERRAIN_CARVER,
//     HITSCAN_WEAPON,
// }


// export interface ItemData {
//     item_type: ItemType,
//     item_name: string,
//     item_id: number;
//     item_sprite: string,
// }


// export interface SimpleItemData extends ItemData {
//     item_type: ItemType.SIMPLE,
// }

// export interface GunItemData extends ItemData {
//     item_type: ItemType.TERRAIN_CARVER | ItemType.HITSCAN_WEAPON,
//     shoot_controller: SimpleWeaponControllerDefinition,
//     capacity: number,
//     reload_time: number,
//     ammo: number
// }


// type toOmit = "item_id" | "item_name";

// type ALL_ITEM_TYPES = Omit<GunItemData,toOmit> | Omit<SimpleItemData, toOmit>;



// const ITEM_DEFINITIONS = DefineSchema< { [K: string]: ALL_ITEM_TYPES } >()({
//     terrain_carver: {
//         item_type: ItemType.TERRAIN_CARVER,
//         item_sprite: "weapon1.png",
//         shoot_controller: { type: "auto", time_between_shots: 15 },
//         capacity: 10,
//         ammo: 100,
//         reload_time: 12,
//     },
//     first_hitscan: {
//         item_type: ItemType.HITSCAN_WEAPON,
//         item_sprite: "weapon1.png",
//         ammo: 1000,
//         capacity: 10,
//         reload_time: 10,
//         shoot_controller: { type: "auto", time_between_shots: 6 },
//     },

// } as const);


// const idToNameMap: Map<number, keyof typeof ITEM_DEFINITIONS> = new Map();
// const nameToIdMap: Map<keyof typeof ITEM_DEFINITIONS, number> = new Map();

// export const ALL_ITEMS = (function(){
//     const shared_item_names = Object.keys(ITEM_DEFINITIONS).sort();

//     let max_id:number = 0;

//     const items: {[key in keyof typeof ITEM_DEFINITIONS]: typeof ITEM_DEFINITIONS[key] & ItemData } = {} as any;

//     for(const name of shared_item_names){
//         const item_name = name;
//         const item_id = max_id++;
//         items[name] = {...ITEM_DEFINITIONS[name], item_id, item_name};

//         //@ts-expect-error
//         idToNameMap.set(item_id, name);
//         //@ts-expect-error
//         nameToIdMap.set(name, item_id);
//     }

//     return items;
// })();

// // Assigns ID's to all the items
// export const ITEM_LINKER = {
//     IDToName(id: number){
//         return idToNameMap.get(id);
//     },
//     NameToID(name: keyof typeof ITEM_DEFINITIONS){
//         return nameToIdMap.get(name);
//     }
// }

// export function CreateItemDataFromID(item_id: number){
//     return CreateItemData(ITEM_LINKER.IDToName(item_id));
// }

// /** Returns a clone of the item template */
// export function CreateItemData<T extends keyof typeof ALL_ITEMS>(item_name: T){
//     return {...ALL_ITEMS[item_name]};
// }

