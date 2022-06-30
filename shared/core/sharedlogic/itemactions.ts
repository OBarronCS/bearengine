import { ENTITY_ID_SERIALIZATION_TYPE_ALIAS } from "../entitysystem";
import { DefineSchema, GenerateLinker, netv, NetworkVariableTypes } from "./serialization";


interface RemoteFunctionDef {
    argTypes: readonly [...NetworkVariableTypes[]],
    callback: (...args: any[]) => void;
}

type ItemActionFormat = { 
    serverbound: RemoteFunctionDef,
    clientbound: RemoteFunctionDef,
    // creatorbound: RemoteFunctionDef 
};
/**
 * Creatorbound 
 *  will be called on a successful positive action!
 *   Will have optional data, like if predicting.
 */


export const ItemActionDef = DefineSchema<{ [K:string]: ItemActionFormat } >()({
    "projectile_shot": {
        serverbound: {
            argTypes:[netv.float(), netv.float(), netv.float(), netv.float()],
            callback: (x, y, dir_x, dir_y) => void 0
        },
        clientbound: {
            argTypes:[netv.float(), netv.float(), netv.float(), netv.float(), netv.uint8(), ENTITY_ID_SERIALIZATION_TYPE_ALIAS()],
            callback: (x, y, vel_x, vel_y, shot_prefab_id, bullet_entity_id) => void 0
        },
    }
} as const);

export const ItemActionLinker = GenerateLinker(ItemActionDef);





