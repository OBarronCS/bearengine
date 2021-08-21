import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { DefineSchema } from "./serialization";
import { SimpleWeaponControllerDefinition } from "./weapondefinitions";


enum ItemType {
    SIMPLE, // Items that you just need to check for the presence of, have no logic; ect: gold
    MODULAR_WEAPON,
    HITSCAN_WEAPON,
}


interface ItemData {
    name: string,
    type: ItemType,
    sprite: string,
}

interface SimpleItemData extends ItemData {
    type: ItemType.SIMPLE,
}

interface WeaponItemData extends ItemData {
    type: ItemType.WEAPON,
    shoot_controller: SimpleWeaponControllerDefinition,
    capacity: number,
    reload_time: number,
    ammo: number
}

type ALL_ITEM_TYPES = WeaponItemData | SimpleItemData;


const ITEM_DEFINITIONS = DefineSchema< { [K: string]: ALL_ITEM_TYPES } >()({
    test: {
        name: "asd",
        type: ItemType.WEAPON,
        sprite: "",
        shoot_controller: { type: "auto", time_between_shots:123 },
        capacity: 10,
        ammo: 10,
        reload_time: 12,
    },
    billy: {
        name: "asd",
        type: ItemType.SIMPLE,
        sprite: "",
    }

} as const);

export function SerializeItemData(stream: BufferStreamWriter, item: ALL_ITEM_TYPES & {item_id: number}): void {

    stream.setUint8(item.item_id);

    switch(item.type){
        case ItemType.SIMPLE: {
            
            break;
        }
        case ItemType.WEAPON: {
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
        case ItemType.WEAPON: {
            targetItem["ammo"] = stream.getUint16();
            
            break;
        }

        default: AssertUnreachable(type);
    }
}


const idToNameMap: Map<number, keyof typeof ITEM_DEFINITIONS> = new Map();
const nameToIdMap: Map< keyof typeof ITEM_DEFINITIONS, number> = new Map();

const ALL_ITEMS = (function(){
    const shared_item_names = Object.keys(ITEM_DEFINITIONS).sort();

    let max_id:number = 0;

    const items: {[key in keyof typeof ITEM_DEFINITIONS]: typeof ITEM_DEFINITIONS[key] & {readonly item_id : number} } = {} as any;

    for(const name of shared_item_names){
        const item_id = max_id++;
        items[name] = {...ITEM_DEFINITIONS[name], item_id };

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



export function CreateItem<T extends keyof typeof ALL_ITEMS>(item_name: T){
    return {...ALL_ITEMS[item_name]};
}

