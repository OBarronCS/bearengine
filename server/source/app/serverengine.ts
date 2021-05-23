

import type { Server } from "ws";
import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { Scene, StreamWriteEntityID } from "shared/core/scene";
import { GamePacket, ServerBoundPacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { AutomaticallyUpdatingEntity, FirstAutoEntity, PlayerEntity, ServerEntity } from "./serverentity";
import { TickTimer } from "shared/ticktimer";
import { SharedEntityServerTable } from "./networking/serverentitydecorators";
import { PacketWriter, RemoteFunctionLinker, RemoteResourceLinker, RemoteResources } from "shared/core/sharedlogic/networkedentitydefinitions";
import { LinkedQueue, Queue } from "shared/datastructures/queue";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { doesNotMatch } from "assert";



const MAX_DATA_PER_PACKET = 2048;

class PlayerInformation {

    constructor(public connectionID: ConnectionID){}

    personalStream = new BufferStreamWriter(new ArrayBuffer(MAX_DATA_PER_PACKET * 2));

    playerEntity: PlayerEntity;

    personalPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();

    serializePersonalPackets(stream: BufferStreamWriter){
        while(this.personalPackets.size() > 0 && this.personalStream.size() < MAX_DATA_PER_PACKET){
            const packet = this.personalPackets.dequeue();
            packet.write(stream);
        }
    }

    
}


export class ServerBearEngine extends AbstractBearEngine {
    
    public readonly TICK_RATE: number;
    private referenceTime: bigint = 0n;
    private referenceTick: number = 0;
    
    public tick = 0;
    private previousTickTime: number = 0;
    public totalTime = 0;


    public network: ServerNetwork = null;
    

    // Subsystems
    private entityManager: Scene<ServerEntity>;
    

    // Serializes the packets in here at end of tick, sends to every player
    private globalPacketsToSerialize: PacketWriter[] = [];

    private lifetimeImportantPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();


    private players = new Map<ConnectionID,PlayerInformation>();
    private clients: ConnectionID[] = [];


    constructor(tick_rate: number){
        super();
        this.TICK_RATE = tick_rate;

        this.entityManager = this.registerSystem(new Scene<ServerEntity>(this));


        for(const system of this.systems){
            system.init()
        }

        // Links shared entity classes
        SharedEntityServerTable.init()
    }


    testBeginLevel(str: keyof typeof RemoteResources){

        const value = RemoteResourceLinker.getIDFromResource(str);

        this.globalPacketsToSerialize.push({
            write(stream){
                stream.setUint8(GamePacket.START_ROUND);
                stream.setFloat32(0);
                stream.setFloat32(0);
                stream.setUint8(value);
            }
        })
    }

    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
    
    start(socket: Server){
        this.network = new ServerNetwork(socket);
        this.network.start();
        this.previousTickTime = Date.now();

        this.loop();
    }

    // Reads from queue of data since last tick
    private readNetwork(){
        const packets = this.network.getPacketQueue();

        while(!packets.isEmpty()){
            const packet = packets.dequeue();
            
            const clientID = packet.client;
            const stream = packet.buffer;

            while(stream.hasMoreData()){
                const type: ServerBoundPacket = stream.getUint8();
                // console.log("Reading type: ", ClientPacket[type]);

                switch(type){
                    case ServerBoundPacket.JOIN_GAME: {

                        console.log("Player joining: ", clientID)
                        if(this.players.get(clientID) !== undefined) throw new Error("Client attempting to join twice")

                        const pInfo = new PlayerInformation(clientID);
                        
                        this.clients.push(clientID);
                        
                        const player = new PlayerEntity();
                        pInfo.playerEntity = player;

                        this.entityManager.addEntity(player);
                        this.players.set(clientID, pInfo);

                        // INIT DATA, tick rate, current time and tick
                        const _this = this;
                        pInfo.personalPackets.enqueue({
                            write(stream){
                                stream.setUint8(GamePacket.INIT);

                                stream.setBigUint64(NETWORK_VERSION_HASH);
                                stream.setUint8(_this.TICK_RATE)
                                stream.setBigUint64(_this.referenceTime);
                                stream.setUint16(_this.referenceTick);
                                stream.setUint8(clientID);
                            }
                        })

                        // START TICKING
                        pInfo.personalPackets.enqueue({
                            write(stream){
                                stream.setUint8(GamePacket.START_TICKING);
                                stream.setUint16(_this.tick);
                            }
                        });
                        
                        pInfo.personalPackets.addAllQueue(this.lifetimeImportantPackets);

                        this.globalPacketsToSerialize.push({
                            write(stream){
                                stream.setUint8(GamePacket.PLAYER_CREATE);
                                stream.setUint8(clientID);
                                StreamWriteEntityID(stream, player.entityID);
                                stream.setFloat32(0);
                                stream.setFloat32(0);
                            }
                        });

                        break;
                    }
                    case ServerBoundPacket.LEAVE_GAME: {
                        console.log(`Player ${clientID} has left the game, engine acknowledge`);
                        const pInfo = this.players.get(clientID);

                        this.players.delete(clientID);
                        const index = this.clients.indexOf(clientID);
                        if(index === -1) throw new Error("Trying to delete a client we don't have.... how is this possible")
                        this.clients.splice(index,1);

                        this.globalPacketsToSerialize.push({
                            write(stream){
                                stream.setUint8(GamePacket.PLAYER_DESTROY);
                                stream.setUint8(clientID);
                                StreamWriteEntityID(stream, pInfo.playerEntity.entityID);
                            }
                        });

                        break;
                    }
                    case ServerBoundPacket.PLAYER_POSITION: {
                        const p = this.players.get(clientID).playerEntity;
                        p.position.x = stream.getFloat32();
                        p.position.y = stream.getFloat32();
                        p.state = stream.getUint8();
                        p.flipped = stream.getBool();
                        p.health = stream.getUint8();

                        break;
                    }

                    case ServerBoundPacket.DAMAGE_OTHER_PLAYER: {
                        const targetPlayer = stream.getUint8();
                        const dmg = stream.getUint8();

                        const p = this.players.get(targetPlayer);

                        if(p !== undefined){
                            p.playerEntity.health -= dmg;

                            p.personalPackets.enqueue({
                                write(stream){
                                    stream.setUint8(GamePacket.DAMAGE_PLAYER);
                                    stream.setUint8(dmg);
                                }
                            })
                        }
                        
                        break;
                    }

                    case ServerBoundPacket.TERRAIN_CARVE_CIRCLE: {
                        const x = stream.getFloat64();
                        const y = stream.getFloat64();
                        const r = stream.getInt32();

                        this.globalPacketsToSerialize.push({
                            write(stream){
                                stream.setUint8(GamePacket.PASSTHROUGH_TERRAIN_CARVE_CIRCLE);
                                stream.setUint8(clientID);
                                stream.setFloat64(x);
                                stream.setFloat64(y);
                                stream.setInt32(r);
                            }
                        });
                        
                        break;
                    }

                    default: AssertUnreachable(type);
                }
            }
        }
    }

    private writeToNetwork(){

        // Get entities marked dirty
        const entitiesToSerialize: ServerEntity[] = []

        for(const entity of this.entityManager.entities){
            if(entity.stateHasBeenChanged){

                entitiesToSerialize.push(entity);

                entity.stateHasBeenChanged = false;
            }
        }

        
        for(const client of this.clients){
            const connection = this.players.get(client);
            const stream = connection.personalStream;

            stream.setUint8(ServerPacketSubType.QUEUE);
            stream.setUint16(this.tick);

            connection.serializePersonalPackets(stream);

            // Write all player positions to packet
            for(const connection of this.clients){
                const player = this.players.get(connection).playerEntity;

                stream.setUint8(GamePacket.PLAYER_POSITION);
                stream.setUint8(connection);
                StreamWriteEntityID(stream, player.entityID);
                stream.setFloat32(player.position.x);
                stream.setFloat32(player.position.y);
                stream.setUint8(player.state);
                stream.setBool(player.flipped);
                stream.setUint8(player.health);
            }

            for(const packet of this.globalPacketsToSerialize){
                packet.write(stream);
            }

            for(const entity of entitiesToSerialize){
                stream.setUint8(GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE);
                SharedEntityServerTable.serialize(stream, entity);
            }
                    
            this.network.send(client, stream.cutoff());
 
            stream.refresh();
        }

        for(const packet of this.globalPacketsToSerialize){
            this.lifetimeImportantPackets.enqueue(packet);
        }
        
        this.globalPacketsToSerialize = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
    }


   


    
    queueRemoteFunction(){
        this.globalPacketsToSerialize.push({

            write(stream){
                RemoteFunctionLinker.serializeRemoteFunction("testFunction", stream,Date.now());
            }

        });

    }

    createRemoteEntityTest(){

        const e = new AutomaticallyUpdatingEntity();

        this.entityManager.addEntity(e);
        
        this.globalPacketsToSerialize.push({
            write(stream){
                stream.setUint8(GamePacket.REMOTE_ENTITY_CREATE);
                stream.setUint8(e.constructor["SHARED_ID"]);
                StreamWriteEntityID(stream, e.entityID);
            }
        });
    }


    private _boundLoop = this.loop.bind(this);


    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if (this.previousTickTime + (1000 / this.TICK_RATE) <= now) {
            const dt = 1000 / this.TICK_RATE;


            this.tick += 1;
            // Think about whether the time should be at beginning or end of tick
            this.referenceTick = this.tick;
            this.referenceTime = BigInt(now);

            this.readNetwork();

            // Check for dead players
            for(const player of this.clients){
                const p = this.players.get(player);
                if(p.playerEntity.health <= 0 && p.playerEntity.dead === false){
                    p.playerEntity.dead = true;

                    console.log("Death!")
                    this.globalPacketsToSerialize.push({
                        write(stream){
                            stream.setUint8(GamePacket.PLAYER_DESTROY);
                            stream.setUint8(player);
                            StreamWriteEntityID(stream, p.playerEntity.entityID);
                        }
                    })
                }
            }


            this.entityManager.update(dt);



            this.writeToNetwork()

            // console.log(Date.now() - now);

            this.previousTickTime = now
        }
    
        // if we are more than 16 milliseconds away from the next tick
        // This avoids blocking like in a while loop. while keeping the timer somewhat accurate
        if(now - this.previousTickTime < (1000 / this.TICK_RATE) - 16) {
            setTimeout(this._boundLoop) // not accurate to the millisecond
        } else {
            setImmediate(this._boundLoop) // ultra accurate, sub millisecond
        }
    }
}


