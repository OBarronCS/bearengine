import { BufferStreamReader } from "shared/datastructures/networkstream";
import { PacketHandler } from "./packethandler";
import { PacketID } from "shared/core/sharedlogic/packetdefinitions"
import { RemoteEntity, SimpleNetworkedSprite } from "./remotecontrol";
import { E } from "../globals";




export class NetworkedEntityManager {

    private handlers: Map<PacketID, PacketHandler> = new Map();

    private entities: Map<number, RemoteEntity> = new Map(); 

    registerHandler(handler: PacketHandler){
        this.handlers.set(handler.packetType, handler);
    }

    constructor(){
        this.registerHandler(new SimplePositionPacketHandler(this.entities))
    
    
    
       //Run Time check that we have all handlers registered
        for(const name in PacketID){
            if(typeof PacketID[name] === "number"){
                const num = PacketID[name] as any as number;
                if(this.handlers.get(num) === undefined) throw new Error("Packet Handler for: " + name + " undefined")
            }
        }
    }

    readData(stream: BufferStreamReader){
        while(stream.hasMoreData()){
            const packetID = stream.getUint16();
            const handler = this.handlers.get(packetID);
            handler.read(stream);
        }
    }
}

class SimplePositionPacketHandler implements PacketHandler {
    readonly packetType = PacketID.SIMPLE_POSITION;

    private entityClassToCreate = SimpleNetworkedSprite;

    private entities: Map<number, RemoteEntity>
    
    constructor(es: Map<number, RemoteEntity>){
        this.entities = es;
    }

    read(stream: BufferStreamReader): void {
        // Find correct entity, gove
        const id = stream.getUint16();
        console.log("ID: " + id)
        let e = this.entities.get(id);
        if(e === undefined){
            console.log("creating new server");
            // e should be an instance of this
            e = new this.entityClassToCreate()
            this.entities.set(id, e);
            E.Engine.addEntity(e);
        }

        e.x = stream.getFloat32();
        e.y = stream.getFloat32();
    }
} 



