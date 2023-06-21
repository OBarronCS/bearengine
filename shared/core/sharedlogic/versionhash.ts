import { ArtRef, LevelRef } from "./assetlinker";
import { ItemActionDef } from "./itemactions";
import { MIGRATED_ITEMS } from "./items";
import { RemoteFunctionStruct, SharedNetworkedEntityDefinitions } from "./networkschemas";
import { ClientBoundImmediate, ClientBoundSubType, GamePacket, ServerBoundPacket, ServerImmediatePacket, ServerPacketSubType } from "./packetdefinitions";
import { MatchGamemode } from "./sharedenums";
import { PROJECTILE_SHOT_DATA } from "./weapondefinitions";

/*
need to add:
    resource folder structure and names
*/


// Prints out the bits for debugging
function BigInt2BinaryString(id: bigint){
    let str = "";
    for(let i = 0n; i < 64n; i++){
        str += !!(id & (1n << (63n - i))) ? "1": "0";
    }
    return str
}

const BITS_FOR_MANUAL = 8n;
const MANUAL_MASK = (1n << BITS_FOR_MANUAL) - 1n;

const BITS_FOR_HASH = 64n - BITS_FOR_MANUAL;
const HASH_MASK = (1n << BITS_FOR_HASH) - 1n; 


export function StringHash(str: string): bigint {
    let stringHash = 0n;
    for(const char of str){
        stringHash = BigInt(char.charCodeAt(0)) + (17n * stringHash);
    }
    return stringHash;
}

// Assumes the enum values are numbers
function EnumHash(hash: object): bigint {
    let totalHash = 3n;
    for(const key in hash){
        // Only lets the strings filter through
        if(isNaN(Number(key))){
            totalHash += StringHash(key) * (BigInt(hash[key]) + 1n) * 17n;
        }
    }

    return totalHash;
}


function ValueHash(value: number | bigint | string | boolean | object | Function ): bigint {
    if(typeof value === "number"){
        if(Number.isInteger(value)) { 
            return BigInt(value);
        } else {
            // If its a float, multiply it by a large number
            return BigInt(Math.round(value * 1759))
        }

    } else if(typeof value === "bigint"){
        return value;
    } else if(typeof value === "string"){
        return StringHash(value);
    } else if(typeof value === "boolean"){
        return value ? 1231n : 1237n;
    } else if(typeof value === "object"){
        return ObjectHash(value);
    } else if(typeof value === "function"){
        return StringHash(value.name);
    }

    throw new Error("Type error, " + value);
}

function ArrayHash(array: any[]): bigint {
    let totalHash = 0n;
    for(let i = 0; i < array.length; i++){
        totalHash += BigInt(i + 1) * ValueHash(array[i]) * 7n;
    }
    return totalHash;
}


function ObjectHash(hashable: object): bigint {
    if(Array.isArray(hashable)){
        return ArrayHash(hashable);
    }

    let totalHash = 0n;

    let i = 1n;
    for(const key in hashable){
        totalHash += (StringHash(key) * i++) + ValueHash(hashable[key]);
        
    }
    return totalHash;
}


// Returns 64 bit BigInt 
function CreateHash(manual: number): bigint {
    const manualMask = (BigInt(manual) & MANUAL_MASK) << (56n);

    let hash = 17n;

    hash += EnumHash(ClientBoundSubType);
    hash += EnumHash(ClientBoundImmediate);
    hash += EnumHash(GamePacket);

    hash += EnumHash(ServerPacketSubType);
    hash += EnumHash(ServerImmediatePacket);
    hash += EnumHash(ServerBoundPacket);

    hash += EnumHash(MatchGamemode);

    hash += ObjectHash(LevelRef);
    hash += ObjectHash(RemoteFunctionStruct);
    hash += ObjectHash(SharedNetworkedEntityDefinitions);
    hash += ObjectHash(ItemActionDef)
    
    hash += ObjectHash(MIGRATED_ITEMS);
    hash += ObjectHash(PROJECTILE_SHOT_DATA);
    hash += ObjectHash(ArtRef);

    // Approximate number of bits needed to represent it: 
    // console.log("Number of bits in hash:", Math.log2(Number(hash)))

    return (manualMask) | (hash & HASH_MASK);
}



const MANUAL_VERSION = 1;

export const NETWORK_VERSION_HASH = CreateHash(MANUAL_VERSION);
console.log(`Network Protocol Hash: [${BigInt2BinaryString(NETWORK_VERSION_HASH)}] (${NETWORK_VERSION_HASH})`);

