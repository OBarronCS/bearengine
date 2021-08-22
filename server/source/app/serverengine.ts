
import path from "path";
import { readFileSync } from "fs";
import type { Server } from "ws";

import { ServerEntity } from "./entity";
import { assert, AssertUnreachable } from "shared/misc/assertstatements";
import { NULL_ENTITY_INDEX, EntitySystem, StreamWriteEntityID } from "shared/core/entitysystem";
import { GamePacket, ServerBoundPacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { PlayerEntity } from "./playerlogic";
import { SharedEntityServerTable } from "./networking/serverentitydecorators";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, RemoteResourceLinker, RemoteResources, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { LinkedQueue, Queue } from "shared/datastructures/queue";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { TerrainManager } from "shared/core/terrainmanager";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { Vec2 } from "shared/shapes/vec2";
import { Rect } from "shared/shapes/rectangle";
import { AbstractEntity } from "shared/core/abstractentity";
import { SerializeTypedVar } from "shared/core/sharedlogic/serialization";
import { BearGame } from "shared/core/abstractengine";
import { EndRoundPacket, HitscanShotPacket, InitPacket, OtherPlayerInfoAddPacket, OtherPlayerInfoRemovePacket, PlayerCreatePacket, PlayerDestroyPacket, RemoteEntityCreatePacket, RemoteEntityDestroyPacket, RemoteEntityEventPacket, RemoteFunctionPacket, ServerIsTickingPacket, SetInvItemPacket, StartRoundPacket } from "./networking/gamepacketwriters";
import { Gamemode } from "shared/core/sharedlogic/sharedenums"
import { SparseSet } from "shared/datastructures/sparseset";
import { ALL_ITEMS, ItemType } from "shared/core/sharedlogic/items";

import "server/source/app/weapons/serveritems.ts"


const MAX_BYTES_PER_PACKET = 2048;

/** Per client info  */
class PlayerInformation {

    /** Unique ID to identify this connection */
    readonly connectionID: ConnectionID;

    /** milliseconds, one way trip NOT two way */
    ping: number = 100;

    gamemode: Gamemode = Gamemode.SPECTATOR;

    constructor(connectionID: ConnectionID){
        this.connectionID = connectionID;
    }

    playerEntity: PlayerEntity;

    
    readonly personalStream = new BufferStreamWriter(new ArrayBuffer(MAX_BYTES_PER_PACKET * 2));
    
    readonly personalPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();

    serializePersonalPackets(stream: BufferStreamWriter){
        while(this.personalPackets.size() > 0 && this.personalStream.size() < MAX_BYTES_PER_PACKET){
            const packet = this.personalPackets.dequeue();
            packet.write(stream);
        }
    }
}


export class ServerBearEngine extends BearGame<{}, ServerEntity> {
    update(dt: number): void {}
    protected onStart(): void {}
    protected onEnd(): void {}
    
    public readonly TICK_RATE: number;
    private referenceTime: bigint = 0n;
    private referenceTick: number = 0;
    
    public tick = 0;
    public totalTime = 0;
    private previousTickTime: number = 0;



    public network: ServerNetwork = null;
    

    public isStageActive: boolean = false;


    // Subsystems
    public levelbbox: Rect;
    public terrain: TerrainManager;

    

    // Serializes the packets in here at end of tick, sends to every player
    private currentTickGlobalPackets: PacketWriter[] = [];

    enqueueGlobalPacket(packet: PacketWriter){
        this.currentTickGlobalPackets.push(packet);
    }

    // Set of all packets that should be sent to any player joining mid-game
    private lifetimeImportantPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();


    
    // connections = new SparseSet<PlayerInformation>();

    public clients: ConnectionID[] = [];
    public players = new Map<ConnectionID,PlayerInformation>();
    


    constructor(tick_rate: number){
        super({});
        this.TICK_RATE = tick_rate;


        // Links shared entity classes
        SharedEntityServerTable.init()
    }

    protected initSystems(){
        this.terrain = this.registerSystem(new TerrainManager(this));
    }

    start(socket: Server){
        this.initialize();

        this.network = new ServerNetwork(socket);
        this.network.start();
        this.previousTickTime = Date.now();

        this.loop();
    }

    // Resets everything to prepare for a new level, sends data to clients
    beginStage(str: keyof typeof RemoteResources){

        this.lifetimeImportantPackets.clear();
        this.currentTickGlobalPackets = [];

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


        const levelID = RemoteResourceLinker.getIDFromResource(str);


        for(let i = 0; i < this.clients.length; i++){
            const clientID = this.clients[i];
 
            const p = this.players.get(clientID);

            const player = new PlayerEntity();
            p.playerEntity = player;
            this.entities.addEntity(player);

            p.personalPackets.enqueue(
                new StartRoundPacket(i * 200, 0, levelID)
            );

            this.enqueueGlobalPacket(
                new PlayerCreatePacket(clientID, i * 200, 0)
            );
            
        }


        this.isStageActive = true;
    }

    endStage(){
        this.terrain.clear();
        this.entities.clear();


        this.isStageActive = false;

        this.enqueueGlobalPacket(
            new EndRoundPacket()
        );
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

                        // Players cannot join MIDGAME!
                        if(this.isStageActive) continue;

                        console.log("Player joining: ", clientID)
                        if(this.players.get(clientID) !== undefined) throw new Error(`Client ${clientID} attempting to join twice`)



                        const clientInfo = new PlayerInformation(clientID);
                        
                        this.clients.push(clientID);
                        this.players.set(clientID, clientInfo);
                        

                        // INIT DATA, tick rate, current time and tick
                        clientInfo.personalPackets.enqueue(
                            new InitPacket(NETWORK_VERSION_HASH,this.TICK_RATE, this.referenceTime, this.referenceTick, clientID)
                        )

                        // START TICKING
                        clientInfo.personalPackets.enqueue(
                            new ServerIsTickingPacket(this.tick)
                        );

                        // Tell the player about the others
                        for(const c of this.players.values()){
                            clientInfo.personalPackets.enqueue(
                                new OtherPlayerInfoAddPacket(c.connectionID, c.ping, c.gamemode)
                            );
                        }
                        
                        
                        clientInfo.personalPackets.addAllQueue(this.lifetimeImportantPackets);


                        this.enqueueGlobalPacket(
                            new OtherPlayerInfoAddPacket(clientID, clientInfo.ping, clientInfo.gamemode)
                        );

                        break;
                    }
                    case ServerBoundPacket.LEAVE_GAME: {
                        console.log(`Player ${clientID} has left the game, engine acknowledge`);

                        const index = this.clients.indexOf(clientID);
                        if(index === -1) {
                            console.log("Trying to delete a client we don't have....")
                            continue;
                        }

                        
                        this.clients.splice(index,1);
                        this.players.delete(clientID);

                        this.enqueueGlobalPacket(
                            new OtherPlayerInfoRemovePacket(clientID)
                        );

                        this.enqueueGlobalPacket(
                            new PlayerDestroyPacket(clientID)
                        );

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

                        p.mousedown = stream.getBool();
                        const isFDown = stream.getBool();
                        const isQDown = stream.getBool();

                        break;
                    }

                    case ServerBoundPacket.SHOOT_WEAPON: {
                        
                        const item_type: ItemType = stream.getUint8();
                        const createServerTick = stream.getFloat32();
                        const pos = new Vec2(stream.getFloat32(), stream.getFloat32());

                        switch(item_type){
                            // fallthrough all non-weapons
                            case ItemType.SIMPLE:{
                                console.log("How did this happen?")
                                break;
                            }
                            case ItemType.TERRAIN_CARVER:{
                                
                                break;
                            }
                            case ItemType.HITSCAN_WEAPON:{
                                const end = new Vec2(stream.getFloat32(), stream.getFloat32());

                                this.enqueueGlobalPacket(
                                    new HitscanShotPacket(createServerTick, pos, end)
                                )

                                // const ray = new Line(pos, Vec2.add(pos, end));
                                // ShootHitscanWeapon(this.game, ray)
                                break;
                            }
                            default: AssertUnreachable(item_type);

                        }
                        
                        
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

        for(const entity of this.entities.entities){
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

            for(const packet of this.currentTickGlobalPackets){
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

        for(const packet of this.currentTickGlobalPackets){
            if(packet.savePacket){
                this.lifetimeImportantPackets.enqueue(packet);
            }
        }
        
        this.currentTickGlobalPackets = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
    }


    //@ts-expect-error
    broadcastRemoteFunction<T extends keyof RemoteFunction>(name: T, ...args: NetCallbackTupleType<RemoteFunction[T]>){
        
        this.enqueueGlobalPacket(
            new RemoteFunctionPacket(name, ...args)
        );
    }

    //@ts-expect-error
    callRemoteFunction<T extends keyof RemoteFunction>(target: ConnectionID, name: T, ...args: NetCallbackTupleType<RemoteFunction[T]>){

        const packet = new RemoteFunctionPacket(name, ...args);

        const connection = this.players.get(target);

        connection.personalPackets.enqueue(packet);
    }

    //@ts-expect-error
    callEntityEvent<SharedName extends keyof SharedNetworkedEntities, EventName extends keyof SharedNetworkedEntities[SharedName]["events"]>(entity: ServerEntity, sharedName: SharedName, event: EventName, ...args: Parameters<NetCallbackTypeV1<SharedNetworkedEntities[SharedName]["events"][EventName]>>){
       
        const id = entity.entityID;
        assert(id !== NULL_ENTITY_INDEX);

        this.enqueueGlobalPacket(new RemoteEntityEventPacket(sharedName, event, entity.constructor["SHARED_ID"], id,...args));
    }



    testweapon(){

        for(const client of this.clients){
            const p = this.players.get(client);


            // p.playerEntity.setWeapon(weapon);

            p.personalPackets.enqueue(new SetInvItemPacket(ALL_ITEMS["first_hitscan"].item_id));
        }

    }



    
    createRemoteEntity(e: ServerEntity){
        this.entities.addEntity(e);
        
        const id = e.entityID;
        
        this.enqueueGlobalPacket(new RemoteEntityCreatePacket(e.constructor["SHARED_ID"], id));
    }

    
    destroyRemoteEntity(e: ServerEntity){

        const id = e.entityID;

        this.enqueueGlobalPacket(new RemoteEntityDestroyPacket(e.constructor["SHARED_ID"], id));

        this.entities.destroyEntity(e);
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
                        this.enqueueGlobalPacket(
                            new PlayerDestroyPacket(player)
                        );
                    }
                }
            }

            for(let i = 0; i < 60/this.TICK_RATE; i++){
                this.entities.update(dt);
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


