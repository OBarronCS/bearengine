

import type { Server } from "ws";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { Scene, StreamWriteEntityID } from "shared/core/scene";
import { GamePacket, ServerBoundPacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { PlayerEntity } from "./serverentity";
import { SharedEntityServerTable } from "./networking/serverentitydecorators";
import { PacketWriter, RemoteFunctionLinker, RemoteResourceLinker, RemoteResources } from "shared/core/sharedlogic/networkschemas";
import { LinkedQueue, Queue } from "shared/datastructures/queue";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { TerrainManager } from "shared/core/terrainmanager";
import { readFileSync } from "fs";
import path from "path";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { Vec2 } from "shared/shapes/vec2";
import { Rect } from "shared/shapes/rectangle";
import { ItemEnum } from "server/source/app/weapons/weaponinterfaces";
import { AbstractEntity } from "shared/core/abstractentity";



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
    

    public isStageActive: boolean = false;

    // Subsystems
    public levelbbox: Rect;
    public terrain: TerrainManager;

    private entityManager: Scene<ServerEntity>;
    

    // Serializes the packets in here at end of tick, sends to every player

    private currentTickPacketsForEveryone: PacketWriter[] = [];

    queuePacket(packet: PacketWriter){
        this.currentTickPacketsForEveryone.push(packet);
    }

    private lifetimeImportantPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();


    public players = new Map<ConnectionID,PlayerInformation>();
    public clients: ConnectionID[] = [];


    constructor(tick_rate: number){
        super();
        this.TICK_RATE = tick_rate;

        //@ts-expect-error
        AbstractEntity.ENGINE_OBJECT = this;

        this.entityManager = this.registerSystem(new Scene<ServerEntity>(this));
        this.terrain = this.registerSystem(new TerrainManager(this));

        for(const system of this.systems){
            system.init()
        }

        // Links shared entity classes
        SharedEntityServerTable.init()
    }

    start(socket: Server){
        this.network = new ServerNetwork(socket);
        this.network.start();
        this.previousTickTime = Date.now();

        this.loop();
    }

    // Resets everything to prepare for a new level, sends data to clients
    beginStage(str: keyof typeof RemoteResources){

        this.lifetimeImportantPackets.clear();
        this.currentTickPacketsForEveryone = [];

        const levelPath = RemoteResources[str];
        const tiledData: TiledMap = JSON.parse(readFileSync(path.join(__dirname, "../../../client/dist/assets/" + levelPath), "utf-8"));
        const levelData = ParseTiledMapData(tiledData);

        {
            // Create terrain and world size
            const worldInfo = levelData.world;
            const width = worldInfo.width;
            const height = worldInfo.height;

            this.levelbbox = new Rect(0,0, width, height);
            
            const bodies = levelData.bodies;
            this.terrain.setupGrid(width, height);
            bodies.forEach( (body) => {
                this.terrain.addTerrain(body.points, body.normals)
            });

            //  this.collisionManager.setupGrid(width, height);
        }


        const value = RemoteResourceLinker.getIDFromResource(str);


        let i = 0;
        for(const clientID of this.clients){
            
            i++;
            const p = this.players.get(clientID);

            const player = new PlayerEntity();
            p.playerEntity = player;
            this.entityManager.addEntity(player);

            p.personalPackets.enqueue({
                write(stream){
                    stream.setUint8(GamePacket.START_ROUND);
                    stream.setFloat32(i * 200);
                    stream.setFloat32(0);
                    stream.setUint8(value);
                }
            });

            this.currentTickPacketsForEveryone.push({
                write(stream){
                    stream.setUint8(GamePacket.PLAYER_CREATE);
                    stream.setUint8(clientID);
                    stream.setFloat32(i * 200);
                    stream.setFloat32(0);
                }
            });
        }


        this.isStageActive = true;
    }

    endStage(){
        this.terrain.clear();
        this.entityManager.clear();


        this.isStageActive = false;

        this.currentTickPacketsForEveryone.push({
            write(stream){
                stream.setUint8(GamePacket.END_ROUND);
            }
        });
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

                switch(type){
                    case ServerBoundPacket.JOIN_GAME: {

                        if(this.isStageActive) continue;

                        console.log("Player joining: ", clientID)
                        if(this.players.get(clientID) !== undefined) throw new Error("Client attempting to join twice")

                        const pInfo = new PlayerInformation(clientID);
                        
                        this.clients.push(clientID);
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
                                stream.setUint8(GamePacket.SERVER_IS_TICKING);
                                stream.setUint16(_this.tick);
                            }
                        });
                        
                        pInfo.personalPackets.addAllQueue(this.lifetimeImportantPackets);


                        break;
                    }
                    case ServerBoundPacket.LEAVE_GAME: {
                        console.log(`Player ${clientID} has left the game, engine acknowledge`);

                        const index = this.clients.indexOf(clientID);
                        if(index === -1) {
                            console.log("Trying to delete a client we don't have....")
                            continue;
                        }
                        
                        this.players.delete(clientID);
                        this.clients.splice(index,1);

                        this.currentTickPacketsForEveryone.push({
                            write(stream){
                                stream.setUint8(GamePacket.PLAYER_DESTROY);
                                stream.setUint8(clientID);
                            }
                        });

                        break;
                    }
                    
                    case ServerBoundPacket.PLAYER_POSITION: {
                        const p = this.players.get(clientID).playerEntity;
                        p.position.x = stream.getFloat32();
                        p.position.y = stream.getFloat32();

                        p.mouse.x = stream.getFloat32();
                        p.mouse.y = stream.getFloat32();


                        p.state = stream.getUint8();
                        p.flipped = stream.getBool();

                        p.mousedown = stream.getBool()
                        const isFDown = stream.getBool()
                        const isQDown = stream.getBool()

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

            for(const packet of this.currentTickPacketsForEveryone){
                packet.write(stream);
            }

            // Don't update players or entities when stage inactive
            if(this.isStageActive){
                // Write all player positions to packet
                for(const connection of this.clients){
                    const player = this.players.get(connection).playerEntity;

                    stream.setUint8(GamePacket.PLAYER_POSITION);
                    stream.setUint8(connection);
                    stream.setFloat32(player.position.x);
                    stream.setFloat32(player.position.y);
                    stream.setUint8(player.state);
                    stream.setBool(player.flipped);
                    stream.setUint8(player.health);
                }
                
                for(const entity of entitiesToSerialize){
                    stream.setUint8(GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE);
                    SharedEntityServerTable.serialize(stream, entity);
                }
            }
                    
            this.network.send(client, stream.cutoff());
 
            stream.refresh();
        }

        for(const packet of this.currentTickPacketsForEveryone){
            this.lifetimeImportantPackets.enqueue(packet);
        }
        
        this.currentTickPacketsForEveryone = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
    }

    //#region testing
    queueRemoteFunction(){
        this.currentTickPacketsForEveryone.push({

            write(stream){
                RemoteFunctionLinker.serializeRemoteFunction("testVecFunction", stream,new Vec2(100.31,200.41));
            }

        });

    }

    testweapon(){

        const weapon = ItemEnum.TERRAIN_CARVER;

        for(const client of this.clients){
            const p = this.players.get(client);

            p.playerEntity.setItem(weapon)
        }

        this.queuePacket({
            write(stream){
                stream.setUint8(GamePacket.SET_ITEM);
                stream.setUint8(weapon);
            }
        });
    }
    //#endregion
    
    createRemoteEntity(e: ServerEntity){
        this.entityManager.addEntity(e);
        
        this.currentTickPacketsForEveryone.push({
            write(stream){
                stream.setUint8(GamePacket.REMOTE_ENTITY_CREATE);
                stream.setUint8(e.constructor["SHARED_ID"]);
                StreamWriteEntityID(stream, e.entityID);
            }
        });
    }

    
    remoteRemoteEntity(e: ServerEntity){
        this.entityManager.destroyEntity(e);

        this.currentTickPacketsForEveryone.push({
            write(stream){
                stream.setUint8(GamePacket.REMOTE_ENTITY_DELETE);
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
            if(this.isStageActive){
                for(const player of this.clients){
                    const p = this.players.get(player);
                    if(p.playerEntity.health <= 0 && p.playerEntity.dead === false){
                        p.playerEntity.dead = true;

                        console.log("Death!")
                        this.currentTickPacketsForEveryone.push({
                            write(stream){
                                stream.setUint8(GamePacket.PLAYER_DESTROY);
                                stream.setUint8(player);
                            }
                        })
                    }
                }
            }

            for(let i = 0; i < 60/this.TICK_RATE; i++){
                this.entityManager.update(dt);
            }



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

export abstract class ServerEntity extends AbstractEntity<ServerBearEngine> {

    // This shouldn't be touched on entities that are not networked
    // Maybe in future make two seperate lists of entities, one for networked and one for not
    stateHasBeenChanged = false;

    markDirty(): void {
        this.stateHasBeenChanged = true;
    }
}

