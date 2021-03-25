import { AbstractBearEngine } from "shared/core/abstractengine";
import { Scene } from "shared/core/scene";
import { PacketWriter } from "shared/core/sharedlogic/networkedentitydefinitions";
import { ServerBoundPacket, ClientPacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Player } from "../../gamelogic/player";
import { RemoteLocations } from "./remotecontrol";
import { BufferedNetwork } from "./socket";


export class NetworkWriteSystem extends Subsystem {
  
    private network: BufferedNetwork;

    private packetsToSerialize: PacketWriter[] = [];

    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
    }

    queuePacket(packet: PacketWriter){
        this.packetsToSerialize.push(packet);
    }

    init(): void {}

    update(delta: number): void {        
        if(this.network.CONNECTED && this.network.SERVER_IS_TICKING){
            const player = this.getSystem(Scene).getEntityByTag<Player>("Player");
            const stream = new BufferStreamWriter(new ArrayBuffer(256));

            // Signifies that everything after this in the packet is gameplay level stuff
            stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);

            stream.setUint8(ClientPacket.PLAYER_POSITION);
            stream.setFloat32(player.x);
            stream.setFloat32(player.y);


            for(const packet of this.packetsToSerialize){
                packet.write(stream);
            }

            this.packetsToSerialize = []

            this.network.send(stream.cutoff());
        }
        
    }
}

