import { StreamWriteEntityID } from "shared/core/entitysystem";
import { ItemType } from "shared/core/sharedlogic/items";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { SerializeTypedVar } from "shared/core/sharedlogic/serialization";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { Vec2 } from "shared/shapes/vec2";
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

export class PlayerEntityGhostPacket extends PacketWriter {

    constructor(public clientID: number){
        super(false);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.PLAYER_ENTITY_GHOST);
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


export class SetInvItemPacket extends PacketWriter {

    constructor(public itemID: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SET_INV_ITEM);
        stream.setUint8(this.itemID);

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
        super(true);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.REMOTE_ENTITY_CREATE);
        stream.setUint8(this.sharedID);
        StreamWriteEntityID(stream, this.entityID);
    }
}


export class RemoteEntityDestroyPacket extends PacketWriter {

    constructor(public sharedID: number, public entityID: number){
        super(true);
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
        super(true);
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

    constructor(public x: number, public y: number, public radius: number, public serverShotID: number){
        super(true);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.TERRAIN_CARVE_CIRCLE);
        stream.setFloat64(this.x);
        stream.setFloat64(this.y);
        stream.setInt32(this.radius);
        stream.setUint32(this.serverShotID);
    }
}


export class HitscanShotPacket extends PacketWriter {

    constructor(public playerID: number, public serverShotID: number, public createServerTick: number,  public start: Vec2, public end: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SHOOT_WEAPON);
        stream.setUint8(this.playerID);
        stream.setUint8(ItemType.HITSCAN_WEAPON);


        stream.setUint32(this.serverShotID);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.end.x);
        stream.setFloat32(this.end.y);

    }
}


export class TerrainCarverShotPacket extends PacketWriter {

    constructor(public playerID: number, public serverShotID: number, public createServerTick: number, public start: Vec2, public velocity: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SHOOT_WEAPON);
        stream.setUint8(this.playerID);
        stream.setUint8(ItemType.TERRAIN_CARVER);

        stream.setUint32(this.serverShotID);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.velocity.x);
        stream.setFloat32(this.velocity.y);
    }
}



export class AcknowledgeShotPacket extends PacketWriter {

    constructor(private success: boolean, private localID: number, private serverID: number){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.ACKNOWLEDGE_SHOT);
        
        stream.setBool(this.success);
        stream.setUint32(this.localID);
        stream.setUint32(this.serverID);
    }
}

