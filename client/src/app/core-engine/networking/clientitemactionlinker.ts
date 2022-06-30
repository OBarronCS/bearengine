import { NetworkPlatformGame } from "../bearengine";
import { ItemActionDef, ItemActionLinker } from "shared/core/sharedlogic/itemactions"
import { ItemActionAck } from "shared/core/sharedlogic/weapondefinitions";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter } from "shared/core/sharedlogic/networkschemas";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { StreamReadEntityID } from "shared/core/entitysystem";
import { SerializeTuple } from "shared/core/sharedlogic/serialization";

//@ts-expect-error
export function register_clientside_itemaction<E extends keyof typeof ItemActionDef>(item_name: E, callback: (game: NetworkPlatformGame, ...data: NetCallbackTupleType<typeof ItemActionDef[E]["clientbound"]>) => void) {

    CLIENT_REGISTERED_ITEMACTIONS.all_functions.push(
        {
            name: item_name,
            //@ts-expect-error
            func:callback,
        }
    );
}

export const CLIENT_REGISTERED_ITEMACTIONS = {
    all_functions: [] as {name:string, func:((game, ...data: any[]) => void)}[],
    id_to_function_map: new Map<number,(game, ...data: any[]) => void>(),

    init(){

        if(this.all_functions.length !== ItemActionLinker.count){
            throw new Error("Missing a item action implementation: " + this.all_functions.map(s => s.name));
        }

        this.all_functions.sort((a,b) => a.name.localeCompare(b.name));

        for(let i = 0; i < this.all_functions.length; i++){
            this.id_to_function_map.set(i, this.all_functions[i].func);
        }

    },
} as const;



export class RequestActionPacket<E extends keyof typeof ItemActionDef> extends PacketWriter {

    constructor(public action_name: E, public local_action_id: number, public args: Parameters<NetCallbackTypeV1<typeof ItemActionDef[E]["serverbound"]>>){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.NEW_AUTO_REQUEST_ITEM_ACTION);
        const shared_id = ItemActionLinker.NameToID(this.action_name);

        stream.setUint8(shared_id);
        stream.setUint32(this.local_action_id);

        //@ts-expect-error
        SerializeTuple(stream, ItemActionLinker.IDToData(shared_id).serverbound.argTypes, this.args)
    }
}



export abstract class PredictAction<E extends keyof typeof ItemActionDef, State> {
    
    // Only set AFTER request is made for now.
    local_action_id: number;

    // state is mutable reference to underlying data/context needed to perform action
    constructor(public readonly game: NetworkPlatformGame, public readonly state: State)
    {

    }
    
    abstract predict_action(): void;

    //@ts-expect-error
    abstract ack_success(...data: NetCallbackTupleType<typeof ItemActionDef[E]["clientbound"]>): void;
    abstract ack_fail(error_code: ItemActionAck): void;

    //@ts-expect-error
    // TypeScript does not allow you to use string constants passed into generic parameters at runtime, so must pass it here
    // Convenience wrapper over networksystem function 
    protected request_action(name: E, ...data: NetCallbackTupleType<typeof ItemActionDef[E]["serverbound"]>){
        this.game.networksystem.request_item_action(name, this, ...data);
    }
}


// // Tests
// const b = register_clientside_itemaction("projectile_shot", 
//     (game: NetworkPlatformGame, dir_x: number, dir_y: number, shot_prefab_id: number, bullet_entity_id: number) => {

// });
// class test extends PredictAction<"projectile_shot", {}> {
    

//     predict_action(): void {
//         throw new Error("Method not implemented.");

//     }

//     ack_success(dir_x: number, dir_y: number, shot_prefab_id: number, bullet_entity_id: number): void {
//         throw new Error("Method not implemented.");
//     }
//     ack_fail(error_code: ItemActionAck): void {
//         throw new Error("Method not implemented.");
//     }


// }



