import { BufferStreamReader } from "shared/datastructures/networkstream";
import { PacketHandler } from "./packethandler";
import { ClientBoundPacket } from "shared/core/sharedlogic/packetdefinitions"
import { RemoteEntity, SimpleNetworkedSprite } from "./remotecontrol";


import { E } from "../globals";



export class NetworkedEntityManager {

    private handlers: Map<ClientBoundPacket, PacketHandler> = new Map();

    private entities: Map<number, RemoteEntity> = new Map(); 

    registerHandler(handler: PacketHandler){
        this.handlers.set(handler.packetType, handler);
    }

    constructor(){
        this.registerHandler(new SimplePositionPacketHandler(this.entities))
    
    
        //Run Time check that we have all handlers registered
        for(const name in ClientBoundPacket){
            if(typeof ClientBoundPacket[name] === "number"){
                const num = ClientBoundPacket[name] as any as number;

                if(num < ClientBoundPacket.SIMPLE_POSITION) continue;


                if(this.handlers.get(num) === undefined) throw new Error("Packet Handler for: " + name + " undefined")
            }
        }
    }

    readData(frame: number, stream: BufferStreamReader){
        while(stream.hasMoreData()){
            const packetID = stream.getUint16();
            const handler = this.handlers.get(packetID);
            handler.read(frame, stream);
        }
    }
}

class SimplePositionPacketHandler implements PacketHandler {
    readonly packetType = ClientBoundPacket.SIMPLE_POSITION;

    private entityClassToCreate = SimpleNetworkedSprite;

    private entities: Map<number, SimpleNetworkedSprite>
    
    constructor(es: Map<number, RemoteEntity>){
        ///@ts-expect-error
        this.entities = es;
    }

    read(frame: number, stream: BufferStreamReader): void {
        // Find correct entity, gove
        const id = stream.getUint16();
       //  console.log("ID: " + id)
        let e = this.entities.get(id);
        if(e === undefined){
            console.log("creating new server entity");
            // e should be an instance of this
            e = new this.entityClassToCreate()
            this.entities.set(id, e);
            E.Engine.addEntity(e);
        }
        
        e.locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
    }
} 



