import { BufferStreamReader } from "shared/datastructures/networkstream";
import { PacketHandler } from "./packethandler";
import { GameStatePacket } from "shared/core/sharedlogic/packetdefinitions"
import { RemoteEntity, SimpleNetworkedSprite } from "./remotecontrol";
import { BearEngine } from "../bearengine";


export class NetworkedEntityManager {

    private handlers: Map<GameStatePacket, PacketHandler> = new Map();

    private entities: Map<number, RemoteEntity> = new Map(); 

    registerHandler(handler: PacketHandler){
        this.handlers.set(handler.packetType, handler);
    }

    constructor(public engine: BearEngine){
        this.registerHandler(new SimplePositionPacketHandler(this.engine, this.entities))
    
    
        //Run Time check that we have all handlers registered
        for(const name in GameStatePacket){
            if(typeof GameStatePacket[name] === "number"){
                const num = GameStatePacket[name] as any as number;

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
    readonly packetType = GameStatePacket.SIMPLE_POSITION;

    private entityClassToCreate = SimpleNetworkedSprite;

    private entities: Map<number, SimpleNetworkedSprite>
    
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
            e = new this.entityClassToCreate()
            this.entities.set(id, e);
            this.engine.addEntity(e);
        }
        
        e.locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
    }
} 



