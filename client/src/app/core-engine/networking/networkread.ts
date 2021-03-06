

// Wraps the connection to a server

import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { Scene } from "shared/core/scene";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { RemoteEntity, RemoteLocations, SimpleNetworkedSprite } from "./remotecontrol";
import { BufferedNetwork } from "./socket";

// Reads packets from network, applies them.
export class NetworkReadSystem extends Subsystem {

    private network: BufferedNetwork;

    public remotelocations = this.addQuery(RemoteLocations);

    // contains networked entities
    private entities: Map<number, RemoteEntity> = new Map(); 

    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
    }

    private scene: Scene;

    init(): void {
        this.scene = this.getSystem(Scene);
    }
    
    // Read from network, apply packets 
    update(delta: number): void {
        if(this.network.CONNECTED){
            const packets = this.network.newPacketQueue();

            while(!packets.isEmpty()){
                const packet = packets.dequeue();
                const frame = packet.id;
                const stream = packet.buffer;

                while(stream.hasMoreData()){
                    const type: GamePacket = stream.getUint8();

                    switch(type){
                        case GamePacket.ENTITY_DESTROY:{
                             // Find correct entity
                            const id = stream.getUint16();

                            let e = this.entities.get(id);
                            if(e !== undefined){
                                console.log("Destroying entity: " + id);

                                this.scene.destroyEntity(e);
                            }
                            break;
                        }
                        case GamePacket.PLAYER_POSITION:{
                            // Find correct entity
                            const id = stream.getUint16();
                            //  console.log("ID: " + id)
                            let e = this.entities.get(id);
                            if(e === undefined){
                                console.log("creating new server entity");
                                // e should be an instance of this
                                e = new SimpleNetworkedSprite()
                                this.entities.set(id, e);
                                this.scene.addEntity(e);
                            }

                            (e as SimpleNetworkedSprite).locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
                            break;    
                        }
                        case GamePacket.SIMPLE_POSITION:{
                            // Find correct entity
                            const id = stream.getUint16();
                            //  console.log("ID: " + id)
                            let e = this.entities.get(id);
                            if(e === undefined){
                                console.log("creating new server entity");
                                // e should be an instance of this
                                e = new SimpleNetworkedSprite()
                                this.entities.set(id, e);
                                this.scene.addEntity(e);
                            }
                            
                            (e as SimpleNetworkedSprite).locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
                            break;
                        }
                        default: AssertUnreachable(type);
                    }
                }
                
            }

            // Interpolation of entities
            const frameToSimulate = this.network.tickToSimulate();

            for(const obj of this.remotelocations){
                obj.setPosition(frameToSimulate)
            }
        }
    }
}
