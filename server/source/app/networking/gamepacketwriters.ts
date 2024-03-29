import { StreamWriteEntityID } from "shared/core/entitysystem";
import { ItemActionDef, ItemActionLinker } from "shared/core/sharedlogic/itemactions";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { GetTemplateRealType, netv, SerializeTuple, SerializeTypedArray, SerializeTypedVar, SharedTemplates } from "shared/core/sharedlogic/serialization";
import { ClientPlayState, MatchGamemode } from "shared/core/sharedlogic/sharedenums";
import { BeamActionType, ItemActionAck } from "shared/core/sharedlogic/weapondefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { Vec2 } from "shared/shapes/vec2";
import { SBaseItem } from "../weapons/serveritems";
import { ConnectionID } from "./serversocket";


export class StartMatchPacket extends PacketWriter {

    constructor(public gamemode: MatchGamemode){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.START_MATCH);
        stream.setUint8(this.gamemode);
    }
}


export class EndMatchPacket extends PacketWriter {

    constructor(public gamemode: MatchGamemode, public winner_id: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.END_MATCH);
        stream.setUint8(this.gamemode);
        stream.setUint8(this.winner_id);
    }
}

// savePacket is irrelevent for packet to specific clients, like this one
export class StartRoundPacket extends PacketWriter {

    constructor(public x: number, public y: number, public level_enum: number, public seconds_until_start: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.START_ROUND);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
        stream.setUint8(this.level_enum);
        stream.setFloat64(this.seconds_until_start);
    }
}

export class EndRoundPacket extends PacketWriter {

    constructor(public winnerOrder: number[], public ticks_until_next_round: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.END_ROUND);

        stream.setUint16(this.ticks_until_next_round);

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

export class LoadLevelPacket extends PacketWriter {

    constructor(public level_enum: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.LOAD_LEVEL);
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


export class PlayerEntityTakeDamagePacket extends PacketWriter {

    constructor(public player_id: number, public new_health: number, public dmg: number){
        super(true);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.PLAYER_ENTITY_TAKE_DAMAGE);

        stream.setUint8(this.player_id);
        stream.setUint8(this.new_health);
        stream.setUint8(this.dmg);
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


export class ConfirmVotePacket extends PacketWriter {

    constructor(public mode: MatchGamemode, public enabled: boolean){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.CONFIRM_VOTE);
        stream.setUint8(this.mode);
        stream.setBool(this.enabled);
    }
}



// Sent to all
export class NewClientDoItemAction_Success_Packet<E extends keyof typeof ItemActionDef> extends PacketWriter {

    constructor(public creator_id: number,
                public action_name: E, 
                public create_server_tick: number, 
                public args: Parameters<NetCallbackTypeV1<typeof ItemActionDef[E]["clientbound"]>>
                ){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.NEW_CLIENT_DO_ITEM_ACTION);
        
        const action_id = ItemActionLinker.NameToID(this.action_name);
        
        stream.setUint8(this.creator_id)
        stream.setUint8(action_id);

        stream.setFloat32(this.create_server_tick);

        //@ts-expect-error
        SerializeTuple(stream, ItemActionLinker.IDToData(action_id).clientbound.argTypes, this.args);
    }
}



// Sent to initiator
export class NewAckItemAction_Success_Packet<E extends keyof typeof ItemActionDef> extends PacketWriter {

    constructor(public action_name: E, 
                public create_server_tick: number, 
                public client_action_id: number,
                public args: Parameters<NetCallbackTypeV1<typeof ItemActionDef[E]["clientbound"]>>
                ){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.NEW_ACK_ITEM_ACTION);
        
        const action_id = ItemActionLinker.NameToID(this.action_name);
        
        stream.setUint8(action_id);

        stream.setUint8(ItemActionAck.SUCCESS);

        stream.setFloat32(this.create_server_tick);
        stream.setUint32(this.client_action_id);

        //@ts-expect-error
        SerializeTuple(stream, ItemActionLinker.IDToData(action_id).clientbound.argTypes, this.args);
    }
}


export class NewAckItemAction_Fail_Packet<E extends keyof typeof ItemActionDef> extends PacketWriter {

    constructor(public action_name: E, 
                public action_code: ItemActionAck,
                public create_server_tick: number, 
                public client_action_id: number,
                ){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.NEW_ACK_ITEM_ACTION);
        
        const action_id = ItemActionLinker.NameToID(this.action_name);
        
        stream.setUint8(action_id);

        stream.setUint8(this.action_code);

        stream.setFloat32(this.create_server_tick);
        stream.setUint32(this.client_action_id);

    }
}





