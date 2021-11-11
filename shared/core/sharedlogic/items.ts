import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { randomInt, random_hash } from "shared/misc/random";
import { Vec2 } from "shared/shapes/vec2";
import { SharedNetworkedEntities } from "./networkschemas";
import { DefineSchema, GenerateLinker, TypescriptTypeOfNetVar } from "./serialization";
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

// This limits the depth of inheritance allowed
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
function CreateItem<T extends keyof SharedNetworkedEntities, K extends Test<T>>(i: Test<T>){ // Readonly<>
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
        capacity: 10,
        ammo: 10,
        reload_time: 12,
        shoot_controller: { type:"auto", time_between_shots: 15 }
    }),

    first_hitscan: CreateItem({
        type:"hitscan_weapon",
        item_name:"Simple Hitscan",
        item_sprite:"tree.gif",
        capacity: 10,
        ammo: 1000,
        reload_time: 10,
        shoot_controller: { type: "auto", time_between_shots: 6 }
    }),

    forcefield: CreateItem({
        type:"forcefield_item",
        item_name:"Force Field",
        item_sprite:"missing_texture.png",
        radius: 50,
    }),



} as const);

export const ITEM_LINKER = GenerateLinker(MIGRATED_ITEMS);

export function RandomItemID(): number {
    return randomInt(0,ITEM_LINKER.count);
}


