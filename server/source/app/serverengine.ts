

import type { Server } from "ws";
import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { EventRegistry } from "shared/core/bearevents";
import { Scene } from "shared/core/scene";
import { BearEvents } from "shared/core/sharedlogic/eventdefinitions";
import { ClientBoundPacket, ClientPacket, GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { AutomaticallyUpdatingEntity, FirstAutoEntity, PlayerEntity, ServerEntity } from "./serverentity";
import { TickTimer } from "shared/ticktimer";
import { SharedEntityServerTable } from "./networking/serverentitydecorators";
import { PacketWriter, RemoteFunctionLinker } from "shared/core/sharedlogic/networkedentitydefinitions";


class PlayerInformation {

    personalStream = new BufferStreamWriter(new ArrayBuffer(2048));

    playerEntity: PlayerEntity;

    // Info that should be serialized and sent to player
    personal_messages: PacketWriter[] = [];

    //dirtyEntities: ServerEntity[] = [];

    constructor(public connectionID: ConnectionID){}
}


export class ServerBearEngine implements AbstractBearEngine {
    
    public readonly TICK_RATE: number;
    public referenceTime: bigint = 0n;
    public referenceTick: number = 0;
    public tick = 0;
    private previousTick: number = 0;
    public totalTime = 0;

    public network: ServerNetwork = null;
    

    private entityManager: Scene<ServerEntity>;

    private systems: Subsystem[] = [];
    public systemEventMap: Map<keyof BearEvents, EventRegistry<keyof BearEvents>>;
    

    globalPacketsToSerialize: PacketWriter[] = [];


    private players = new Map<ConnectionID,PlayerInformation>();
    private clients: ConnectionID[] = [];

   
    constructor(tick_rate: number){
        this.TICK_RATE = tick_rate;

        this.entityManager = this.registerSystem(new Scene<ServerEntity>(this));


        for(const system of this.systems){
            system.init()
        }

        // Links shared entity classes
        SharedEntityServerTable.init()


        //  Set event handlers on server?
    }


    registerSystem<T extends Subsystem>(system: T): T {
        this.systems.push(system);
        return system;
    }
    
    getSystem<T extends Subsystem<AbstractBearEngine>>(query: new (...args: any[]) => T): T {
        const name = query.name;
        for(const system of this.systems){
            // @ts-expect-error
            if(system.constructor.name === name) return system;
        }

        return null;
    }
    
    start(socket: Server){
        this.network = new ServerNetwork(socket);
        this.network.start();
        this.previousTick = Date.now();

        this.loop();
    }

    // Reads from queue of data since last tick
    private readNetwork(){
        const packets = this.network.packetQueue();

        while(!packets.isEmpty()){
            const packet = packets.dequeue();
            
            const client = packet.client;
            const stream = packet.buffer;

            while(stream.hasMoreData()){
                const type: ClientPacket = stream.getUint8();
                // console.log("Reading type: ", ClientPacket[type]);

                switch(type){
                    // Client sends JOIN_GAME packet for now
                    case ClientPacket.JOIN_GAME: {

                        console.log("Someone is trying to join: ", client)
                        if(this.players.get(client) !== undefined) throw new Error("Client attempting to join twice")

                        const pInfo = new PlayerInformation(client);
                        
                        this.clients.push(client);
                        
                        const player = new PlayerEntity();
                        pInfo.playerEntity = player;

                        this.entityManager.addEntity(player);
                        this.players.set(client, pInfo);

                        // INIT DATA, tick rate, current time and tucj                        
                        const _this = this;
                        pInfo.personal_messages.push({
                            write(stream){
                                stream.setUint8(ClientBoundPacket.INIT);

                                stream.setUint8(_this.TICK_RATE)
                                stream.setBigUint64(_this.referenceTime);
                                stream.setUint16(_this.referenceTick);
                                stream.setUint8(client);
                            }
                        })

                        // START TICKING
                        pInfo.personal_messages.push({
                            write(stream){
                                stream.setUint8(ClientBoundPacket.START_TICKING);
                                stream.setUint16(_this.tick);
                            }
                        });
                        
                        
                        break;
                    }
                    case ClientPacket.LEAVE_GAME: {
                        console.log(`Player ${client} has left the game, engine acknowledge`);
                        const pInfo = this.players.get(client);

                        this.players.delete(client);
                        const index = this.clients.indexOf(client);
                        if(index === -1) throw new Error("Trying to delete a client we don't have.... how is this possible")
                        this.clients.splice(index,1);

                        this.globalPacketsToSerialize.push({
                            write(stream){
                                stream.setUint8(GamePacket.ENTITY_DESTROY);
                                stream.setUint16(pInfo.playerEntity.entityID);
                            }
                        });

                        break;
                    }
                    case ClientPacket.PLAYER_POSITION: {
                        const p = this.players.get(client).playerEntity;
                        p.position.x = stream.getFloat32();
                        p.position.y = stream.getFloat32();

                        break;
                    }
                    case ClientPacket.TERRAIN_CARVE_CIRCLE: {
                        const x = stream.getFloat64();
                        const y = stream.getFloat64();
                        const r = stream.getInt32();

                        this.globalPacketsToSerialize.push({
                            write(stream){
                                stream.setUint8(GamePacket.PASSTHROUGH_TERRAIN_CARVE_CIRCLE);
                                stream.setUint8(client);
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

        const entitiesToSerialize: ServerEntity[] = []

        // Entities auto updating variables over network
        for(const entity of this.entityManager.entities){
            if(entity.stateHasBeenChanged){

                entitiesToSerialize.push(entity);

                entity.stateHasBeenChanged = false;
            }
        }


        for(const client of this.clients){
            const connection = this.players.get(client);
            const stream = connection.personalStream;

            for(const message of connection.personal_messages){
                message.write(stream);
            }

            connection.personal_messages = [];

            stream.setUint8(ClientBoundPacket.GAME_STATE_PACKET);
            stream.setUint16(this.tick);

            // Write all player positions to packet
            for(const connection of this.clients){
                const player = this.players.get(connection).playerEntity;

                stream.setUint8(GamePacket.PLAYER_POSITION);
                stream.setUint16(player.entityID);
                stream.setFloat32(player.position.x);
                stream.setFloat32(player.position.y);
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

        this.globalPacketsToSerialize = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
    }


    private _boundLoop = this.loop.bind(this);

    private tickTimer = new TickTimer(30);


    
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
                stream.setUint16(e.entityID);
            }
        });
    }



    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if (this.previousTick + (1000 / this.TICK_RATE) <= now) {
            const dt = 1000 / this.TICK_RATE;

            if(this.tickTimer.tick()){ 
                
              
            }

            this.tick += 1;
            // Think about whether the time should be at beginning or end of tick
            this.referenceTick = this.tick;
            this.referenceTime = BigInt(now);

            this.readNetwork();

            for(const system of this.systems){
                system.update(dt);
            }

            this.writeToNetwork()

            // console.log(Date.now() - now);

            this.previousTick = now
        }
    
        // if we are more than 16 milliseconds away from the next tick
        // This avoids blocking like in a while loop. while keeping the timer somewhat accurate
        if(now - this.previousTick < (1000 / this.TICK_RATE) - 16) {
            setTimeout(this._boundLoop) // not accurate to the millisecond
        } else {
            setImmediate(this._boundLoop) // ultra accurate, sub millisecond
        }
    }
}


