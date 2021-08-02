import { StreamWriteEntityID } from "shared/core/entitysystem";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { SerializeTypedVar } from "shared/core/sharedlogic/serialization";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ItemEnum } from "../weapons/weapondefinitions";


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

    constructor(){
        super(true);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.END_ROUND)
    }
}

export class InitPacket extends PacketWriter {
   

    constructor(public network_version_hash: bigint, public tick_rate: number, public referenceTime: bigint, public referenceTick: number, public yourPlayerID: number){
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
        super(true);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.SERVER_IS_TICKING);
        stream.setUint16(this.tick);
    }
}



export class PlayerCreatePacket extends PacketWriter {

    constructor(public clientID: number, public x: number, public y: number){
        super(true);
    }

    write(stream: BufferStreamWriter): void {
        stream.setUint8(GamePacket.PLAYER_CREATE);
        stream.setUint8(this.clientID);
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}

export class PlayerDestroyPacket extends PacketWriter {

    constructor(public clientID: number){
        super(true);
    }

    write(stream: BufferStreamWriter): void {

        stream.setUint8(GamePacket.PLAYER_DESTROY);
        stream.setUint8(this.clientID);
    
    }
    
}


export class SetItemPacket extends PacketWriter {

    constructor(public weaponID: ItemEnum){
        super(true);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(GamePacket.SET_ITEM);
        stream.setUint8(this.weaponID)

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

