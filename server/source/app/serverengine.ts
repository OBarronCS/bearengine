

import type { Server } from "ws";
import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { EventRegistry } from "shared/core/bearevents";
import { Scene } from "shared/core/scene";
import { BearEvents } from "shared/core/sharedlogic/eventdefinitions";
import { ClientBoundPacket, ClientPacket, GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { ClientConnection, ServerNetwork } from "./networking/serversocket";
import { NetworkedEntity, PlayerEntity } from "./serverentity";
import { PacketWriter } from "./networking/packetwriter";


class ServerBearEngine implements AbstractBearEngine {
    
    public readonly TICK_RATE: number;
    public referenceTime: bigint = 0n;
    public referenceTick: number = 0;
    public tick = 0;


    public network: ServerNetwork = null;

    public totalTime = 0;
    private previousTick: number = 0;

    private entityManager: Scene;

    systemEventMap: Map<keyof BearEvents, EventRegistry<keyof BearEvents>>;
    private systems: Subsystem[] = [];


    packetsToSerialize: PacketWriter[] = [];


    private players = new Map<ClientConnection,PlayerEntity>();


    constructor(tick_rate: number){
        this.TICK_RATE = tick_rate;

        this.entityManager = this.registerSystem(new Scene(this));





        for(const system of this.systems){
            system.init()
        }

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

            const type: ClientPacket = stream.getUint8();

            switch(type){
                // Client sends JOIN_GAME packet for now
                case ClientPacket.JOIN_GAME: {
                    // TODO: first check that it hasn't already been created.
                    const player = new PlayerEntity();
               
                    this.entityManager.addEntity(player);
                    this.players.set(client, player);

                    // TODO: DEFER ALL OF THIS
                    // INIT DATA --> send immediately
                    const init_writer = new BufferStreamWriter(new ArrayBuffer(12));
                    
                    init_writer.setUint8(ClientBoundPacket.INIT);
                    init_writer.setUint8(this.TICK_RATE)
                    init_writer.setBigUint64(this.referenceTime);
                    init_writer.setUint16(this.referenceTick);
                    this.network.send(client,init_writer.getBuffer());

                    
                    // START TICKING
                    const start_tick_writer = new BufferStreamWriter(new ArrayBuffer(3));

                    start_tick_writer.setUint8(ClientBoundPacket.START_TICKING);
                    start_tick_writer.setUint16(this.tick);

                    this.network.send(client,start_tick_writer.getBuffer());

                    break;
                }
                case ClientPacket.LEAVE_GAME: {
                    const player = this.players.get(client);
                    this.players.delete(client);

                    this.packetsToSerialize.push({
                        write(stream){
                            stream.setUint8(GamePacket.ENTITY_DESTROY);
                            stream.setUint16(player.entityID);
                        }
                    });

                    break;
                }
                case ClientPacket.PLAYER_POSITION: {
                    const p = this.players.get(client);
                    p.position.x = stream.getFloat32();
                    p.position.y = stream.getFloat32();

                    break;
                }
                

                default: AssertUnreachable(type);
            }
        }
    }

    writeToNetwork(){
        // Write all PacketData to a buffer
        const stream = new BufferStreamWriter(new ArrayBuffer(256));

        // This is from old system. Change?
        stream.setUint8(ClientBoundPacket.GAME_STATE_PACKET);
        stream.setUint16(this.tick);
    
        // Treat players specially
        for(const player of this.players.values()){
            stream.setUint8(GamePacket.PLAYER_POSITION);
            stream.setUint16(player.entityID);
            stream.setFloat32(player.position.x);
            stream.setFloat32(player.position.y);
        }

        for(const packet of this.packetsToSerialize){
            packet.write(stream);
        }
        this.packetsToSerialize = [];
    

        
        for(const client of this.players.keys()){
            this.network.send(client, stream.cutoff());
        }

        console.log(this.tick,Date.now()  - this.previousTick);
    }

    private _boundLoop = this.loop.bind(this);

    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if (this.previousTick + (1000 / this.TICK_RATE) <= now) {
            const dt = 1000 / this.TICK_RATE;

            // if(chance(15)){ 
            //     console.log("NEW")
            //     this.addNetworkedEntity(new FirstNetworkedEntity());    
            // }

            this.tick += 1;
            // Think about whether the time should be at beginning or end of tick
            this.referenceTick = this.tick;
            this.referenceTime = BigInt(now);

            this.readNetwork();

            for(const system of this.systems){
                system.update(dt);
            }

            this.writeToNetwork()

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


export {
    ServerBearEngine,
}

