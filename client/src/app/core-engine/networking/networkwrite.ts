import { AbstractBearEngine } from "shared/core/abstractengine";
import { Scene } from "shared/core/scenemanager";
import { ServerBoundPacket, ClientPacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Player } from "../../gamelogic/player";
import { RemoteLocations } from "./remotecontrol";
import { BufferedNetwork } from "./socket";


export class NetworkWriteSystem extends Subsystem {
  
    private network: BufferedNetwork;

    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
    }

    init(): void {
        
    }

    update(delta: number): void {
        // Purely for testing. 
        
        if(this.network.CONNECTED && this.network.SERVER_IS_TICKING){
            const player = this.getSystem(Scene).getEntityByTag<Player>("Player");
            const stream = new BufferStreamWriter(new ArrayBuffer(1 + 1 + 4 + 4));

            stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);
            stream.setUint8(ClientPacket.PLAYER_POSITION);
            stream.setFloat32(player.x);
            stream.setFloat32(player.y);

            this.network.send(stream.getBuffer());
        }
        
    }
}

