import { BufferStreamReader } from "shared/datastructures/networkstream";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions"
import { RemoteEntity, SimpleNetworkedSprite } from "./remotecontrol";
import { BearEngine } from "../bearengine";
import { AbstractEntity } from "shared/core/abstractentity";

export interface PacketHandler {
    readonly packetType: GamePacket;
    read(frame: number, stream: BufferStreamReader): void;
}

export class NetworkedEntityManager {

    private handlers: Map<GamePacket, PacketHandler> = new Map();

    private entities: Map<number, RemoteEntity> = new Map(); 

    registerHandler(handler: PacketHandler){
        this.handlers.set(handler.packetType, handler);
    }

    constructor(public engine: BearEngine){
        this.registerHandler(new SimplePositionPacketHandler(this.engine, this.entities));
        this.registerHandler(new PlayerPacketHandler(this.engine, this.entities));
        this.registerHandler(new EntityDestroyerHandler(this.engine, this.entities));

        //Run Time check that we have all handlers registered
        for(const name in GamePacket){
            if(typeof GamePacket[name] === "number"){
                const num = GamePacket[name] as any as number;

                if(this.handlers.get(num) === undefined) throw new Error("Packet Handler for: " + name + " undefined")
            }
        }
    }

    readData(frame: number, stream: BufferStreamReader){
        while(stream.hasMoreData()){
            const packetID = stream.getUint8();
            const handler = this.handlers.get(packetID);
            handler.read(frame, stream);
        }
    }
}

class SimplePositionPacketHandler implements PacketHandler {
    readonly packetType = GamePacket.SIMPLE_POSITION;

    private entities: Map<number, SimpleNetworkedSprite>;
    
    constructor(public engine: BearEngine, es: Map<number, RemoteEntity>){
        ///@ts-expect-error
        this.entities = es;
    }

    read(frame: number, stream: BufferStreamReader): void {
        // Find correct entity
        const id = stream.getUint16();
       //  console.log("ID: " + id)
        let e = this.entities.get(id);
        if(e === undefined){
            console.log("creating new server entity");
            // e should be an instance of this
            e = new SimpleNetworkedSprite()
            this.entities.set(id, e);
            this.engine.addEntity(e);
        }
        
        e.locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
    }
} 

class PlayerPacketHandler extends SimplePositionPacketHandler {
    // @ts-expect-error
    readonly packetType = GamePacket.PLAYER_POSITION;
}


class EntityDestroyerHandler implements PacketHandler {
    readonly packetType = GamePacket.ENTITY_DESTROY;

    private entities: Map<number, AbstractEntity>;
    
    constructor(public engine: BearEngine, es: Map<number, RemoteEntity>){
        this.entities = es;
    }

    read(frame: number, stream: BufferStreamReader): void {
        // Find correct entity
        const id = stream.getUint16();

        let e = this.entities.get(id);
        if(e !== undefined){
            console.log("Destroying entity: " + id);

            this.engine.destroyEntity(e);
        }
    
    } 
}

