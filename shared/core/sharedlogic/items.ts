import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_int, random_hash } from "shared/misc/random";
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

    paintball: CreateItem({
        type:"projectile_weapon",
        item_name:"",
        item_sprite:"missing_texture.png",
        ammo: 100,
        capacity: 100,
        initial_speed: 7*8,
        juice: { knockback: 0, shake: {type:"normal", shake: 0}},
        reload_time: 10,
        shoot_controller: {type:"semiauto", time_between_shots: 10},
        shot_name:"PAINT_BALL"
    }),

    to_mouse: CreateItem({
        type:"projectile_weapon",
        item_name:"",
        item_sprite:"missing_texture.png",
        ammo: 100,
        capacity: 100,
        initial_speed: 7,
        juice: { knockback: 0, shake: {type:"normal", shake: 0}},
        reload_time: 10,
        shoot_controller: {type:"semiauto", time_between_shots: 10},
        shot_name:"SHORT_LIVE"
    }),

    bouncing_weapon:CreateItem({
        type:"projectile_weapon",
        item_name:"",
        item_sprite:"",
        ammo: 111,
        capacity: 100,
        reload_time: 100,
        
        shoot_controller: {type:"pulse", time_between_shots:56, time_between_bullet: 12, submode:"semiauto", shots_per_burst: 2 },
        shot_name: "BOUNCING_SHOT",
        
        initial_speed: 33,

        juice:{knockback:4,shake:{type:"normal", shake: .2}},
    }),
    
    ice_slow_weapon: CreateItem({
        type:"projectile_weapon",
        item_name:"AHH",
        item_sprite:"ice_slow_weapon.png",
        ammo: 100,
        capacity: 100,
        initial_speed: 20,
        reload_time: 100,
        shoot_controller: {type:"semiauto", time_between_shots: 32},
        shot_name:"ICE_SHOT",

        juice:{knockback:3,shake:{type:"normal", shake: 0}},
    }),

    second_shotgun: CreateItem({
        type: "shotgun_weapon",
        item_name: "SHOTGUN",
        item_sprite: "second_shotgun.png",
        ammo: 100,
        capacity: 100,
        reload_time:10,
        
        shoot_controller: {type: "semiauto", time_between_shots: 20},
        spread: 8,
        count: 7,
        initial_speed: 24,
        shot_name:"COOL_SHOT_2",

        juice:{knockback:5,shake:{type:"normal", shake: .2}},
    }),

    first_shotgun: CreateItem({
        type: "shotgun_weapon",
        item_name: "SHOTGUN",
        item_sprite: "second_shotgun.png",
        ammo: 100,
        capacity: 100,
        reload_time:10,
        
        shoot_controller: {type: "semiauto", time_between_shots: 20},
        spread: 10,
        count: 4,
        initial_speed: 10,
        shot_name:"COOL_SHOT",

        juice:{knockback:10,shake:{type:"normal", shake: .25}},

    }),

    cool_fast: CreateItem({
        type:"projectile_weapon",
        item_name:"Cool",
        item_sprite:"cool_bullet.png",
        ammo:100,
        capacity:100,
        initial_speed: 34,
        reload_time: 10,
        shoot_controller:{type:"auto", time_between_shots:7},
        shot_name: "COOL_SHOT",

        juice:{knockback:2,shake:{type:"normal", shake: .20}},
    }),

    swap_item: CreateItem({
        item_name: "Swapper",
        item_sprite: "fireball.png",
        type:"swap_item"
    }),

    "tp_item": CreateItem({
        item_name: "Telepearl",
        item_sprite: "fireball.png",
        type:"teleport_item"
    }),

    emoji_weapon: CreateItem({
        type:"projectile_weapon",
        item_name:"Emoji weapon",
        item_sprite:"weapon1.png",
        capacity: 10,
        ammo: 100,
        reload_time: 12,
        shoot_controller: { type:"auto", time_between_shots: 8 },
        shot_name: "EMOJI_SHOT",
        initial_speed: 11,

        juice:{knockback:0,shake:{type:"normal", shake: .1}},
    }),

    circle_terrain_carver: CreateItem({
        type:"projectile_weapon",
        item_name:"Circle Carver",
        item_sprite:"weapon1.png",
        capacity: 10,
        ammo: 10,
        reload_time: 12,
        shoot_controller: { type:"auto", time_between_shots: 15 },
        shot_name: "SIMPLE_TERRAIN_HIT",
        initial_speed: 25,

        juice:{knockback:6,shake:{type:"normal", shake: .2}},
    }),

    terrain_nosedive: CreateItem({
        type:"projectile_weapon",
        item_name:"Circle Carver",
        item_sprite:"weapon1.png",
        capacity: 10,
        ammo: 10,
        reload_time: 12,
        shoot_controller: { type:"auto", time_between_shots: 15 },
        shot_name: "NOSEDIVE",
        initial_speed: 50,

        juice:{knockback:8,shake:{type:"normal", shake: .25}},
    }),

    laser_shooter: CreateItem({
        type:"projectile_weapon",
        item_name:"Circle Carver",
        item_sprite:"weapon1.png",
        capacity: 15,
        ammo: 15,
        reload_time: 12,
        shoot_controller: { type:"charge", percent_per_tick: .04, percent_loss: .01 },
        shot_name: "LASER_ON_HIT",
        initial_speed: 70,

        juice:{knockback:0,shake:{type:"normal", shake: 0}},
    }),

    first_hitscan: CreateItem({
        type:"hitscan_weapon",
        item_name:"Simple Hitscan",
        item_sprite:"hitscan.png",
        capacity: 25,
        ammo: 25,
        reload_time: 10,
        shoot_controller: { type: "auto", time_between_shots: 6 },
        hitscan_effects: [],

        juice:{knockback:0,shake:{type:"normal", shake: .1}},
    }),

    second_hitscan: CreateItem({
        type:"hitscan_weapon",
        item_name:"Simple Hitscan",
        item_sprite:"hitscan.png",
        capacity: 25,
        ammo: 25,
        reload_time: 10,
        shoot_controller: { type: "auto", time_between_shots: 16 },
        hitscan_effects: [{
            type:"lightning"
        }],

        juice:{knockback:1,shake:{type:"normal", shake: .25}},
    }),

    forcefield: CreateItem({
        type:"forcefield_item",
        item_name:"Force Field",
        item_sprite:"forcefield_item.png",
        radius: 100,
    }),

    auto_beam: CreateItem({
        item_name:"beam",
        item_sprite:"beam_weapon.png",
        type:"beam_weapon",
    }),



} as const);

export const ITEM_LINKER = GenerateLinker(MIGRATED_ITEMS);

export function RandomItemID(): number {
    return random_int(0,ITEM_LINKER.count);
}


