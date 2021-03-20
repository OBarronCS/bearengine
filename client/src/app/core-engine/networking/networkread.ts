import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { AbstractEntity } from "shared/core/abstractentity";
import { Scene } from "shared/core/scene";
import { NetworkedEntityNames } from "shared/core/sharedlogic/networkedentitydefinitions";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { Entity } from "../entity";
import { SharedEntityClientTable } from "./cliententitydecorators";
import { RemoteEntity, RemoteLocations, SimpleNetworkedSprite } from "./remotecontrol";
import { BufferedNetwork } from "./socket";



/** Reads packets from network, applies them */
export class NetworkReadSystem extends Subsystem {



    private network: BufferedNetwork;

    public remotelocations = this.addQuery(RemoteLocations);

    // contains networked entities
    private entities: Map<number, RemoteEntity> = new Map(); 

    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
    }

    private getEntity<T extends AbstractEntity = AbstractEntity>(id: number): T{
        return this.entities.get(id) as any as T;
    }

    private scene: Scene;

    init(): void {
        // Sort networked alphabetically, so they match up on server side
        // Gives them id probably don't need that on client side though
        SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.sort( (a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        for(let i = 0; i < SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES.length; i++){
            const registry = SharedEntityClientTable.REGISTERED_NETWORKED_ENTITIES[i];
            SharedEntityClientTable.networkedEntityIndexMap.set(i,registry.create);
            registry.create["SHARED_ID"] = i;
        }



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
                        case GamePacket.REMOTE_ENTITY_CREATE: {
                            const sharedClassID = stream.getUint8();
                            const eId = stream.getUint16();
                            const _class = SharedEntityClientTable.networkedEntityIndexMap.get(sharedClassID);

                            //@ts-expect-error
                            const e = new _class();

                            // Adds it to the scene
                            this.entities.set(eId, e);
                            this.scene.addEntity(e);

                            break;
                        }

                        case GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE:{
                            // [entity id, ...variables]
 
                            const eId = stream.getUint16();
                            const e = this.entities.get(eId);

                            if(e === undefined){
                                console.log("CANNOT FIND ENTITY WITH THAT VARIABLE. WILL QUIT");
                                // Idk how else to deal with this error, than to quit.
                                return
                            }
                            e.constructor["deserializeVariables"](e, stream);

                            break;
                        }

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
                                console.log("creating new server player entity");
                                // e should be an instance of this
                                e = new SimpleNetworkedSprite();
                                this.entities.set(id, e);
                                this.scene.addEntity(e);
                            }

                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            (e as SimpleNetworkedSprite).locations.addPosition(frame, x,y);
                            
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
