
import path from "path";
import { readFileSync } from "fs";
import type { Server } from "ws";

import { ServerEntity } from "./entity";
import { assert, AssertUnreachable } from "shared/misc/assertstatements";
import { NULL_ENTITY_INDEX, EntitySystem, StreamWriteEntityID } from "shared/core/entitysystem";
import { GamePacket, ServerBoundPacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { ServerPlayerEntity } from "./playerlogic";
import { SharedEntityServerTable, S_T_Sub } from "./networking/serverentitydecorators";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, RemoteResourceLinker, RemoteResources, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { LinkedQueue, Queue } from "shared/datastructures/queue";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { TerrainManager } from "shared/core/terrainmanager";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { Vec2 } from "shared/shapes/vec2";
import { Rect } from "shared/shapes/rectangle";
import { AbstractEntity } from "shared/core/abstractentity";
import { DeserializeShortString, SerializeTypedVar } from "shared/core/sharedlogic/serialization";
import { BearGame } from "shared/core/abstractengine";
import { AcknowledgeShotPacket, EndRoundPacket, HitscanShotPacket, InitPacket, JoinLatePacket, OtherPlayerInfoAddPacket, OtherPlayerInfoRemovePacket, OtherPlayerInfoUpdateGamemodePacket, PlayerEntityCompletelyDeletePacket, PlayerEntityGhostPacket, PlayerEntitySpawnPacket, RemoteEntityCreatePacket, RemoteEntityDestroyPacket, RemoteEntityEventPacket, RemoteFunctionPacket, ServerIsTickingPacket, SetGhostStatusPacket, SetInvItemPacket, SpawnYourPlayerEntityPacket, StartRoundPacket, TerrainCarverShotPacket } from "./networking/gamepacketwriters";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums"
import { SparseSet } from "shared/datastructures/sparseset";
import {  } from "shared/core/sharedlogic/items";


import { ServerBullet, ServerShootHitscanWeapon, ServerShootTerrainCarver } from "./weapons/serveritems";
import { commandDispatcher } from "./servercommands";

import "server/source/app/weapons/serveritems.ts"
import { random_range } from "shared/misc/random";
import { Effect } from "shared/core/effects";
import { ShotType } from "shared/core/sharedlogic/weapondefinitions";

const MAX_BYTES_PER_PACKET = 2048;

/** Per client info  */
export class PlayerInformation {

    /** Unique ID to identify this connection */
    readonly connectionID: ConnectionID;

    /** milliseconds, one way trip, NOT two way */
    ping: number = 100;
    gamemode: ClientPlayState = ClientPlayState.SPECTATING;
    playerEntity: ServerPlayerEntity;

    constructor(connectionID: ConnectionID){
        this.connectionID = connectionID;
    }

    
    readonly personalStream = new BufferStreamWriter(new ArrayBuffer(MAX_BYTES_PER_PACKET * 2));
    
    readonly personalPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();

    serializePersonalPackets(stream: BufferStreamWriter){
        while(this.personalPackets.size() > 0 && this.personalStream.size() < MAX_BYTES_PER_PACKET){
            const packet = this.personalPackets.dequeue();
            packet.write(stream);
        }
    }
}



enum ServerGameState {
    /** Lobby, waiting for players to join
     *  Spawn player entities.
     *  Players are in ACTIVE state if join now
     *  Player share locations. 
     *  No one can die
     */
    PRE_MATCH_LOBBY, 

    ROUND_ACTIVE,
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

    // Websocket server
    public network: ServerNetwork = null;
    
    // connections = new SparseSet<PlayerInformation>();
    private readonly clients: ConnectionID[] = [];
    private readonly players = new Map<ConnectionID,PlayerInformation>();
    


    private serverState: ServerGameState = ServerGameState.PRE_MATCH_LOBBY;
    public activeScene: ServerScene = null;


    // Subsystems
    public terrain: TerrainManager;

    

    // Serializes the packets in here at end of tick, sends to every player
    private currentTickGlobalPackets: PacketWriter[] = [];
    enqueueGlobalPacket(packet: PacketWriter){
        this.currentTickGlobalPackets.push(packet);
    }

    // Set of all packets that should be sent to any player joining mid-game
    private savedPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();


 
    

    private serverShotID = 0;
    getServerShotID(){
        return this.serverShotID++;
    }

    constructor(tick_rate: number){
        super({});
        this.TICK_RATE = tick_rate;


        // Links shared entity classes
        SharedEntityServerTable.init()
    }

    protected initSystems(){
        this.terrain = this.registerSystem(new TerrainManager(this));
    }

    // /** Remove all references to this client immediately */
    // removeclient(clientID: ConnectionID){
    //     const player = this.players.get(clientID);
    // }

    start(socket: Server){
        this.initialize();

        this.network = new ServerNetwork(socket);

    
        this.network.start(
            this.onClientConnect.bind(this),
            this.onClientLeave.bind(this)
        );
        this.previousTickTime = Date.now();

        this.loop();
    }

    private onClientConnect(clientID: ConnectionID){
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

        // Tell the client about the other clients
        for(const c of this.players.values()){
            clientInfo.personalPackets.enqueue(
                new OtherPlayerInfoAddPacket(c.connectionID, c.ping, c.gamemode)
            );
        }

        // Tell the client to spawn entities for all other clients that are alive
        for(const p of this.players.values()){
            if(p.gamemode === ClientPlayState.ACTIVE){
                clientInfo.personalPackets.enqueue(
                    new PlayerEntitySpawnPacket(p.connectionID, p.playerEntity.x, p.playerEntity.y)
                );
            }
        }


        // Tell other clients about the fact that a new client just joined!
        this.enqueueGlobalPacket(
            new OtherPlayerInfoAddPacket(clientID, clientInfo.ping, clientInfo.gamemode)
        );


        // If the player is joining mid-match
        if(this.serverState === ServerGameState.ROUND_ACTIVE){
            clientInfo.personalPackets.enqueue(
                new JoinLatePacket(this.activeScene.levelID)
            );

            // Gives the client all the data from the current level
            clientInfo.personalPackets.addAllQueue(this.savedPackets);
        } else {

            this.createPlayerEntity(clientInfo);

        }

    }

    // Always called, whenever a client disconnects
    // This will get called after calling "clientkick" on websocket server
    private onClientLeave(clientID: ConnectionID): void {
        // Clear all data associated with this client
        console.log(`Player leaving: ${clientID}`);

        const index = this.clients.indexOf(clientID);
        if(index === -1) {
            console.log(`Trying to delete a client, ${clientID}, we don't have.`)
            return;
        }


        this.clients.splice(index,1);
        this.players.delete(clientID);

        this.enqueueGlobalPacket(
            new OtherPlayerInfoRemovePacket(clientID)
        );

        this.enqueueGlobalPacket(
            new PlayerEntityCompletelyDeletePacket(clientID)
        );
        
        if(this.serverState === ServerGameState.ROUND_ACTIVE){
            this.activeScene.activePlayerEntities.remove(clientID);
        }    
    }


    beginMatch(){
        console.log("Match begins");
        this.serverState = ServerGameState.ROUND_ACTIVE;
    }

    endMatch(){
        console.log("Ending match");

        this.serverState = ServerGameState.PRE_MATCH_LOBBY;
    }
    // Resets everything to prepare for a new level, sends data to clients
    // Everyone who is spectating is now active
    beginRound(str: keyof typeof RemoteResources){
        if(this.serverState !== ServerGameState.ROUND_ACTIVE){
            this.beginMatch();
        }

        console.log("New round!");
        this.entities.clear();
        this.terrain.clear();


        this.savedPackets.clear();
        this.currentTickGlobalPackets = [];

        // #region Loading level data
        const levelPath = RemoteResources[str];
        const tiledData: TiledMap = JSON.parse(readFileSync(path.join(__dirname, "../../../client/dist/assets/" + levelPath), "utf-8"));
        const levelData = ParseTiledMapData(tiledData);


        const levelID = RemoteResourceLinker.getIDFromResource(str);
    
        // Create terrain and world size
        const worldInfo = levelData.world;
        const width = worldInfo.width;
        const height = worldInfo.height;


        const bodies = levelData.bodies;
        this.terrain.setupGrid(width, height);
        bodies.forEach(body => {
            this.terrain.addTerrain(body.points, body.normals)
        });

        //  this.collisionManager.setupGrid(width, height);
        //#endregion

        


        this.activeScene = new ServerScene(levelID, new Rect(0,0,width,height));

        for(let i = 0; i < this.clients.length; i++){
            const clientID = this.clients[i];
 
            const p = this.players.get(clientID);

            // If someone waiting to join, allow them to spectate
            if(p.gamemode === ClientPlayState.SPECTATING){
                this.createPlayerEntity(p);
            }

            if(p.gamemode === ClientPlayState.GHOST){
                p.gamemode = ClientPlayState.ACTIVE;

                p.personalPackets.enqueue(
                    new SetGhostStatusPacket(false)
                );

                this.enqueueGlobalPacket(
                    new OtherPlayerInfoUpdateGamemodePacket(clientID,ClientPlayState.ACTIVE)
                );
            }

            // All players state should be Active at this point
            

            // Add back player entities to the game world
            const player = new ServerPlayerEntity(clientID);
            p.playerEntity = player;
            this.entities.addEntity(player);


            this.activeScene.activePlayerEntities.set(clientID, p.playerEntity);


            const spawn_x = 150 + (i * 200);
            const spawn_y = 0;


            p.personalPackets.enqueue(
                new StartRoundPacket(spawn_x, spawn_y, levelID)
            );

            this.enqueueGlobalPacket(
                new PlayerEntitySpawnPacket(clientID, 0,0)
            );
        }

        this.createRemoteEntity(new S_T_Sub())
    }

    // Tells clients to create the player entity.
    // Sets gamemode to Active
    createPlayerEntity(client: PlayerInformation){
        const clientID = client.connectionID

        const player = new ServerPlayerEntity(clientID);

        client.gamemode = ClientPlayState.ACTIVE;
        client.playerEntity = player;

        this.entities.addEntity(player);


        // Tells them to spawn a local player and to start sharing position with other players
        client.personalPackets.enqueue(
            new SpawnYourPlayerEntityPacket(random_range(100, 500), 0)
        );

        // Tell others that this guy just spawned
        this.enqueueGlobalPacket(
            new PlayerEntitySpawnPacket(clientID, 0,0)
        );

        // Tell others to update this clients Gamemode to ACTIVE
        this.enqueueGlobalPacket(
            new OtherPlayerInfoUpdateGamemodePacket(clientID,ClientPlayState.ACTIVE)
        );
    }

    // Clear data for a round, send players data on who won, ect
    endRound(){
        if(this.clients.length <= 1){
            this.endMatch();
        } else {
            console.log("Clear level");

            this.savedPackets.clear();
    
            this.beginRound("LEVEL_ONE");
        }
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

    dispatchCommand(command: string){
        const result = commandDispatcher.parseMultiCommand({engine:this, targetPlayer: null}, command);

        if(result.success === false){
            console.log(`Command failed: ${result.error}`)
        }
    }


    dispatchClientCommand(command: string, clientID: ConnectionID){
        const player = this.players.get(clientID);

        const result = commandDispatcher.parseMultiCommand({engine:this, targetPlayer: player}, command);

        if(result.success === false){
            console.log(`Command failed: ${result.error}`)
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


    // Reads from queue of data since last tick
    private readNetwork(){
        const packets = this.network.getPacketQueue();

        while(!packets.isEmpty()){
            const packet = packets.dequeue();
            
            const clientID = packet.client;
            const stream = packet.buffer;

            if(!this.players.has(clientID)){
                console.log(`Ignoring a packet from a disconnected client, ${clientID}`)
                continue;
            }


            while(stream.hasMoreData()){
                const type: ServerBoundPacket = stream.getUint8();

                switch(type){
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

                    case ServerBoundPacket.REQUEST_CHAT_MESSAGE: {
                        
                        const string = DeserializeShortString(stream);

                        if(string.length > 0){
                            // If a command 
                            if(string.charAt(0) === "/") {

                                this.dispatchClientCommand(string.substring(1), clientID);
                                

                            } else {
                                // Forward it as a chat to other players
                                // if(this.chatEnabled) {}
                            }
                        } else {
                            console.log(`Client ${clientID} sent an empty string`)
                        }



                        break;
                    }

                    case ServerBoundPacket.REQUEST_SHOOT_WEAPON: {
                        
                        const item_type: ShotType = stream.getUint8();

                        const clientShotID = stream.getUint32();

                        const createServerTick = stream.getFloat32();
                        const pos = new Vec2(stream.getFloat32(), stream.getFloat32());

                        switch(item_type){
                            case ShotType.TERRAIN_CARVER:{
                                const velocity = new Vec2(stream.getFloat32(), stream.getFloat32());

                                const shotID = this.getServerShotID();

                                this.players.get(clientID).personalPackets.enqueue(
                                    new AcknowledgeShotPacket(true,clientShotID, shotID)
                                )

                                this.enqueueGlobalPacket(
                                    new TerrainCarverShotPacket(clientID, shotID, createServerTick, pos, velocity)
                                );

                                ServerShootTerrainCarver(this, shotID, pos, velocity);

                                

                                break;
                            }
                            case ShotType.HIT_SCAN:{
                                const end = new Vec2(stream.getFloat32(), stream.getFloat32());

                                const shotID = this.getServerShotID();

                                this.enqueueGlobalPacket(
                                    new HitscanShotPacket(clientID, shotID, createServerTick, pos, end)
                                );
                                
                                ServerShootHitscanWeapon(this, shotID, pos, end, clientID);

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

            // // Don't update players or entities when stage inactive
            // if(this.serverState === ServerGameState.ROUND_ACTIVE){

            // Write all active player positions, health to packet
            for(const connection of this.clients){

                const c = this.players.get(connection);

                if(c.gamemode === ClientPlayState.ACTIVE){
                    const player = c.playerEntity;

                    stream.setUint8(GamePacket.PLAYER_ENTITY_POSITION);
                    stream.setUint8(connection);
                    stream.setFloat32(player.position.x);
                    stream.setFloat32(player.position.y);
                    stream.setUint8(player.state);
                    stream.setBool(player.flipped);
                    stream.setUint8(player.health);
                }
            }
            
            for(const entity of entitiesToSerialize){
                stream.setUint8(GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE);
                SharedEntityServerTable.serialize(stream, entity);
            }
            
                    
            this.network.send(client, stream.cutoff());
 
            stream.refresh();
        }

        for(const packet of this.currentTickGlobalPackets){
            if(packet.savePacket){
                this.savedPackets.enqueue(packet);
            }
        }
        
        this.currentTickGlobalPackets = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
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

            for(let i = 0; i < 60/this.TICK_RATE; i++){
                this.entities.update(dt);
            }

            // Round logic
            // Check for dead players
            if(this.serverState === ServerGameState.ROUND_ACTIVE){
                for(const playerEntity of this.activeScene.activePlayerEntities.values()){

                    if(playerEntity.health <= 0){
                        
                        playerEntity.health = 0;
                        playerEntity.dead = true;
                        
                        const playerID = playerEntity.connectionID;
                        const connection = this.players.get(playerID);

                        console.log(`Player ${playerID} died!`);

                        this.activeScene.deadplayers.push(playerID);
                        this.entities.destroyEntity(playerEntity);
                        this.activeScene.activePlayerEntities.remove(playerID);
                        
                        
                        connection.gamemode = ClientPlayState.GHOST;

                        connection.personalPackets.enqueue(
                            new SetGhostStatusPacket(true)
                        );

                        this.enqueueGlobalPacket(
                            new OtherPlayerInfoUpdateGamemodePacket(playerID, ClientPlayState.GHOST)
                        );

                        this.enqueueGlobalPacket(
                            new PlayerEntityGhostPacket(playerID)
                        );   
                    }
                }

                if(this.activeScene.roundOver === false){
                    if(this.activeScene.activePlayerEntities.size() === 0){
                        this.endMatch();
                        
                    } else if(this.activeScene.activePlayerEntities.size() === 1){

                        this.activeScene.roundOver = true;


                        if(this.activeScene.activePlayerEntities.size() > 0){
                            this.activeScene.deadplayers.push(this.activeScene.activePlayerEntities.keys()[0]);
                        }
                
                        this.enqueueGlobalPacket(
                            new EndRoundPacket([...this.activeScene.deadplayers].reverse())
                        );

                        const effect = new ServerEffect() ;
                        effect.onDelay(60 * 3, () => {
                            this.endRound();
                        });
                        effect.destroyAfter(60 * 3);

                        this.entities.addEntity(effect);
                    }
                }
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


class ServerScene {

    public roundOver: boolean = false;
    public readonly levelID: number;
    public readonly levelbbox: Rect;
    public readonly deadplayers: ConnectionID[] = [];
    
    // Set of player entities that are ALIVE!
    public readonly activePlayerEntities: SparseSet<ServerPlayerEntity> = new SparseSet(256);

    constructor(levelID: number, levelbbox: Rect){
        this.levelID = levelID;
        this.levelbbox = levelbbox;
    }


}


//Band-aid fix 

class ServerEffect extends Effect<ServerBearEngine> {
    stateHasBeenChanged = false;
    markDirty(): void {
        this.stateHasBeenChanged = true;
    }
}
