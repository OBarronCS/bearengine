import { BufferStreamReader } from "shared/datastructures/networkstream";
import { PacketHandler } from "./packethandler";
import { PacketID } from "shared/core/sharedlogic/packetdefinitions"
import { RemoteEntity, SimpleNetworkedSprite } from "./remotecontrol";
import { E } from "../globals";




export class NetworkedEntityManager {

    private handlers: Map<PacketID, PacketHandler> = new Map();

    private entities: Map<number, RemoteEntity> = new Map(); 

    registerHandler(packetid: PacketID, handler: PacketHandler){
        this.handlers.set(packetid, handler);
    }

    constructor(){
        this.registerHandler(PacketID.SIMPLE_POSITION, new this.positionEntityClass(this.entities))
    }

    readData(stream: BufferStreamReader){
        const packetID = stream.getUint16();
        const handler = this.handlers.get(packetID);
        handler.read(stream);
    }

    private positionEntityClass = class SimplePositionPacketHandler extends PacketHandler {
        
        private entityClassToCreate = SimpleNetworkedSprite;
        private entities: Map<number, RemoteEntity>
        constructor(es: Map<number, RemoteEntity>){
            super();
            this.entities = es;

        }

        read(stream: BufferStreamReader): void {
            // Find correct entity, gove
            const id = stream.getUint16();
            let e = this.entities.get(id);
            if(e === undefined){
                // e should be an instance of this
                e = new this.entityClassToCreate()
                this.entities.set(id, e);
                E.Engine.addEntity(e);
            }

            e.read(stream);
        }
    } 
}





