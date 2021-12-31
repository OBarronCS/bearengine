import { StreamWriteEntityID } from "shared/core/entitysystem";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { GetTemplateRealType, netv, SerializeTypedArray, SerializeTypedVar, SharedTemplates } from "shared/core/sharedlogic/serialization";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { BeamActionType, ItemActionAck, ItemActionType } from "shared/core/sharedlogic/weapondefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { Vec2 } from "shared/shapes/vec2";
import { SBaseItem } from "../weapons/serveritems";
import { ConnectionID } from "./serversocket";


// savePacket is irrelevent for packet to specific clients, like this one
export class StartRoundPacket extends PacketWriter {

    constructor(public x: number, public y: number, public level_enum: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.START_ROUND);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
        stream.setUint8(this.level_enum);
    }
}

export class EndRoundPacket extends PacketWriter {

    constructor(public winnerOrder: number[]){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.END_ROUND);

        stream.setUint8(this.winnerOrder.length);

        for(let i = 0; i < this.winnerOrder.length; i++){
            stream.setUint8(this.winnerOrder[i]);
        }
    }
}

export class SpawnYourPlayerEntityPacket extends PacketWriter {

    constructor(public x: number, public y: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SPAWN_YOUR_PLAYER_ENTITY);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}

export class SetGhostStatusPacket extends PacketWriter {

    constructor(public ghost: boolean){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SET_GHOST_STATUS);
        stream.setBool(this.ghost);
    }
}

export class JoinLatePacket extends PacketWriter {

    constructor(public level_enum: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.JOIN_LATE_INFO);
        stream.setUint8(this.level_enum);

    }
}

export class InitPacket extends PacketWriter {
   

    constructor(public network_version_hash: bigint, public tick_rate: number, public referenceTime: bigint, public referenceTick: number, public yourPlayerID: ConnectionID){
        super(false)
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.INIT);

        stream.setBigUint64(this.network_version_hash);
        stream.setUint8(this.tick_rate)
        stream.setBigUint64(this.referenceTime);
        stream.setUint16(this.referenceTick);
        stream.setUint8(this.yourPlayerID);
    }
}


export class DeclareCommandsPacket extends PacketWriter {

    constructor(public struct: GetTemplateRealType<typeof SharedTemplates["COMMANDS"]>[]){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.DECLARE_COMMANDS);
        SerializeTypedArray(stream, netv.template(SharedTemplates["COMMANDS"].format), this.struct)
    }
}


export class ServerIsTickingPacket extends PacketWriter {

    constructor(public tick: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.SERVER_IS_TICKING);
        stream.setUint16(this.tick);
    }
}


export class OtherPlayerInfoAddPacket extends PacketWriter {
    
    constructor(public playerID: ConnectionID, public ping: number, public gamemode: ClientPlayState){
        super(false)
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.OTHER_PLAYER_INFO_ADD);
        
        stream.setUint8(this.playerID);
        stream.setUint16(this.ping);
        stream.setUint8(this.gamemode);
    }
}

export class OtherPlayerInfoUpdateGamemodePacket extends PacketWriter {
    
    constructor(public playerID: ConnectionID, public gamemode: ClientPlayState){
        super(false)
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.OTHER_PLAYER_INFO_GAMEMODE);
        
        stream.setUint8(this.playerID);
        stream.setUint8(this.gamemode);
    }
}


export class OtherPlayerInfoRemovePacket extends PacketWriter {

    constructor(public playerID: ConnectionID){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.OTHER_PLAYER_INFO_REMOVE);
        stream.setUint8(this.playerID);
    }
}





export class PlayerEntitySpawnPacket extends PacketWriter {

    constructor(public clientID: number, public x: number, public y: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.PLAYER_ENTITY_SPAWN);
        stream.setUint8(this.clientID);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}

export class PlayerEntityDeathPacket extends PacketWriter {

    constructor(public clientID: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.PLAYER_ENTITY_DEATH);
        stream.setUint8(this.clientID);
    }
}

export class PlayerEntityCompletelyDeletePacket extends PacketWriter {

    constructor(public clientID: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.PLAYER_ENTITY_COMPLETELY_DELETE);
        stream.setUint8(this.clientID);
    }
}

export class PlayerEntitySetItemPacket extends PacketWriter {

    constructor(public player_id: number, public item_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.PLAYER_ENTITY_SET_ITEM);
        stream.setUint8(this.player_id);
        stream.setUint8(this.item_id);
    }
}

export class PlayerEntityClearItemPacket extends PacketWriter {

    constructor(public player_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.PLAYER_ENTITY_CLEAR_ITEM);
        stream.setUint8(this.player_id);
    }
}


// This has a potential for an error, because the data could have changed
// while the game logic assumes the data does not change after the item is passed int
export class SetInvItemPacket extends PacketWriter {

    constructor(public itemID: number, public item: SBaseItem<any>){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SET_INV_ITEM);
        stream.setUint8(this.itemID);

        const SHARED_ID = this.item.constructor["SHARED_ID"];

        const variableslist = SharedEntityLinker.sharedIDToVariables(SHARED_ID);

        for(const variable of variableslist){

            //@ts-expect-error
            SerializeTypedVar(stream, variable.type, this.item[variable.variableName]);
        }

    }
}

export class ClearInvItemPacket extends PacketWriter {

    constructor(){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.CLEAR_INV_ITEM);
    }
}



export class RemoteFunctionPacket<T extends keyof RemoteFunction> extends PacketWriter {

    public name: T;
    public argument_data: NetCallbackTupleType<RemoteFunction[T]>

    //@ts-expect-error
    constructor(name: T, ...args: NetCallbackTupleType<RemoteFunction[T]>){
        super(true);
        this.name = name;
        this.argument_data = args;
    }

    write(stream: BufferStreamWriter){

        //@ts-expect-error --> It doesn't think that this.argument_data is an array
        RemoteFunctionLinker.serializeRemoteFunction(this.name, stream, ...this.argument_data);
           
    }
}

export class RemoteEntityCreatePacket extends PacketWriter {

    constructor(public sharedID: number, public entityID: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.REMOTE_ENTITY_CREATE);
        stream.setUint8(this.sharedID);
        StreamWriteEntityID(stream, this.entityID);
    }
}


export class RemoteEntityDestroyPacket extends PacketWriter {

    constructor(public sharedID: number, public entityID: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.REMOTE_ENTITY_DELETE);
        stream.setUint8(this.sharedID);
        StreamWriteEntityID(stream, this.entityID);
    }
}

export class RemoteEntityEventPacket<TSharedName extends keyof SharedNetworkedEntities, TEventName extends keyof SharedNetworkedEntities[TSharedName]["events"]> extends PacketWriter {


    //@ts-expect-error
    public argument_data: Parameters<NetCallbackTypeV1<SharedNetworkedEntities[TSharedName]["events"][TEventName]>>

    //@ts-expect-error
    constructor(public sharedName: TSharedName, public eventName: TEventName, public sharedID: number, public entityID: number, ...argument_data: Parameters<NetCallbackTypeV1<SharedNetworkedEntities[TSharedName]["events"][TEventName]>>){
        super(false);
        this.argument_data = argument_data;
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.REMOTE_ENTITY_EVENT);
        stream.setUint8(this.sharedID);
        StreamWriteEntityID(stream, this.entityID);
        stream.setUint8(SharedEntityLinker.eventNameToEventID(this.sharedName, this.eventName));
        
        //@ts-ignore --> simply wrong
        const data = SharedNetworkedEntityDefinitions[this.sharedName]["events"][this.eventName]["argTypes"];

        for (let i = 0; i < data.length; i++) {
            //@ts-expect-error
            SerializeTypedVar(stream,data[i], this.argument_data[i])
        }
    }
}



export class TerrainCarveCirclePacket extends PacketWriter {

    constructor(public x: number, public y: number, public radius: number){
        super(true);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.TERRAIN_CARVE_CIRCLE);
        stream.setFloat64(this.x);
        stream.setFloat64(this.y);
        stream.setInt32(this.radius);
    }
}




export class ActionDo_HitscanShotPacket extends PacketWriter {

    constructor(public playerID: number, public createServerTick: number, public start: Vec2, public end: Vec2, public prefab_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.GENERAL_DO_ITEM_ACTION);
        
        stream.setUint8(this.playerID);
        stream.setUint8(ItemActionType.HIT_SCAN);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.end.x);
        stream.setFloat32(this.end.y);

        stream.setUint8(this.prefab_id);

    }
}


export class ActionDo_ProjectileShotPacket extends PacketWriter {

    constructor(public creator_player_id: number, public createServerTick: number, public start: Vec2, public velocity: Vec2, public shot_prefab_id: number, public entity_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.GENERAL_DO_ITEM_ACTION);
        
        stream.setUint8(this.creator_player_id);
        stream.setUint8(ItemActionType.PROJECTILE_SHOT);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);




        stream.setFloat32(this.velocity.x);
        stream.setFloat32(this.velocity.y);

        stream.setUint8(this.shot_prefab_id);
        StreamWriteEntityID(stream, this.entity_id);
    }
}

export class ActionDo_ShotgunShotPacket extends PacketWriter {

    constructor(public creator_player_id: number, public createServerTick: number, public start: Vec2, public velocity: Vec2, public shot_prefab_id: number, public shotgun_prefab_id: number, public entity_id_list: number[]){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.GENERAL_DO_ITEM_ACTION);
        
        stream.setUint8(this.creator_player_id);
        stream.setUint8(ItemActionType.SHOTGUN_SHOT);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.velocity.x);
        stream.setFloat32(this.velocity.y);

        stream.setUint8(this.shot_prefab_id);
        stream.setUint8(this.shotgun_prefab_id);

        // ENTITY SERIALIZE
        SerializeTypedArray(stream, netv.uint32(), this.entity_id_list);
        // StreamWriteEntityID(stream, this.entity_id);
    }
}

export class ActionDo_BeamPacket extends PacketWriter {

    constructor(public playerID: number, public createServerTick: number, public start: Vec2, public action_type: BeamActionType, public beam_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.GENERAL_DO_ITEM_ACTION);
        
        stream.setUint8(this.playerID);
        stream.setUint8(ItemActionType.BEAM);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setUint8(this.action_type);
        stream.setUint32(this.beam_id);
    }
}


// ForceFields are created through entities, so this is not needed
// export class ForceFieldEffectPacket extends PacketWriter {

//     constructor(public playerID: number, public createServerTick: number,  public start: Vec2){
//         super(false);
//     }

//     write(stream: BufferStreamWriter){
//         stream.setUint8(GamePacket.SHOOT_WEAPON);
//         stream.setUint8(this.playerID);

//         stream.setUint8(ItemActionType.FORCE_FIELD_ACTION);
        
//         stream.setFloat32(this.createServerTick);

//         stream.setFloat32(this.start.x);
//         stream.setFloat32(this.start.y);
//     }
// }


/** General ack packet */
export class AcknowledgeItemActionPacket extends PacketWriter {

    constructor(public action_type: ItemActionType, public success: ItemActionAck, public clientside_action_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.ACKNOWLEDGE_ITEM_ACTION);
        stream.setUint8(this.action_type);
        stream.setUint8(this.success);
        stream.setUint32(this.clientside_action_id);
    }
}

export class AcknowledgeItemAction_PROJECTILE_SHOT_SUCCESS_Packet extends PacketWriter {

    constructor(public clientside_action_id: number, public bullet_entity_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.ACKNOWLEDGE_ITEM_ACTION);
        stream.setUint8(ItemActionType.PROJECTILE_SHOT);
        stream.setUint8(ItemActionAck.SUCCESS);
        stream.setUint32(this.clientside_action_id);

        StreamWriteEntityID(stream, this.bullet_entity_id);
    }
}

export class AcknowledgeItemAction_SHOTGUN_SHOT_SUCCESS_Packet extends PacketWriter {

    constructor(public clientside_action_id: number, public local_ids: number[], public bullet_entity_id_list: number[]){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.ACKNOWLEDGE_ITEM_ACTION);
        stream.setUint8(ItemActionType.SHOTGUN_SHOT);
        stream.setUint8(ItemActionAck.SUCCESS);
        stream.setUint32(this.clientside_action_id);

        SerializeTypedArray(stream, netv.uint32(), this.local_ids);
        SerializeTypedArray(stream, netv.uint32(), this.bullet_entity_id_list);
        //StreamWriteEntityID(stream, this.bullet_entity_id);
    }
}




/** Personal packet */
export class ForcePositionPacket extends PacketWriter {

    constructor(public x: number, public y: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.FORCE_POSITION);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}


