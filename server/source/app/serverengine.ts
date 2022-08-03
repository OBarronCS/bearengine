
import path from "path";
import { readFileSync } from "fs";
import { Server } from "ws";

import { ServerEntity } from "./entity";
import { assert, AssertUnreachable } from "shared/misc/assertstatements";
import { NULL_ENTITY_INDEX, EntitySystem, StreamWriteEntityID } from "shared/core/entitysystem";
import { GamePacket, ServerBoundPacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { ConnectionID, ServerNetwork } from "./networking/serversocket";
import { ServerPlayerEntity } from "./playerlogic";
import { NetworkedEntity, SharedEntityServerTable, S_T_Sub } from "./networking/serverentitydecorators";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker, SharedNetworkedEntities, SharedNetworkedEntityDefinitions } from "shared/core/sharedlogic/networkschemas";
import { LinkedQueue, Queue } from "shared/datastructures/queue";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { TerrainManager } from "shared/core/terrainmanager";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { Vec2 } from "shared/shapes/vec2";
import { dimensions, Rect } from "shared/shapes/rectangle";
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { DeserializeShortString, DeserializeTuple, DeserializeTypedArray, netv, SerializeTypedVar } from "shared/core/sharedlogic/serialization";
import { BearGame, BearScene } from "shared/core/abstractengine";
import { ClearInvItemPacket, DeclareCommandsPacket, EndRoundPacket, InitPacket, LoadLevelPacket, OtherPlayerInfoAddPacket, OtherPlayerInfoRemovePacket, OtherPlayerInfoUpdateGamemodePacket, PlayerEntityCompletelyDeletePacket, PlayerEntityDeathPacket, PlayerEntitySpawnPacket, RemoteEntityCreatePacket, RemoteEntityDestroyPacket, RemoteEntityEventPacket, RemoteFunctionPacket, ServerIsTickingPacket, SetGhostStatusPacket, SetInvItemPacket, SpawnYourPlayerEntityPacket, StartRoundPacket, PlayerEntitySetItemPacket, PlayerEntityClearItemPacket, ForcePositionPacket, ConfirmVotePacket } from "./networking/gamepacketwriters";
import { ClientPlayState, MatchDurationType, MatchGamemode } from "shared/core/sharedlogic/sharedenums"
import { SparseSet } from "shared/datastructures/sparseset";
import { ITEM_LINKER, RandomItemID } from "shared/core/sharedlogic/items";


import { BeamEffect_S, ForceFieldEffect_S, ForceFieldItem_S, InstantDeathLaser_S, ItemActivationType, ItemEntity, ItemEntityPhysicsMode, PlayerSwapperItem, SBaseItem, ServerShootHitscanWeapon, ServerShootProjectileWeapon, SHitscanWeapon, ShootShotgunWeapon_S, ShotgunWeapon_S, SProjectileWeaponItem } from "./weapons/serveritems";
import { commandDispatcher } from "./servercommands";

import { random, random_int, random_range } from "shared/misc/random";
import { BeamActionType, SHOT_LINKER } from "shared/core/sharedlogic/weapondefinitions";
import { LevelRefLinker, LevelRef } from "shared/core/sharedlogic/assetlinker";
import { choose, shuffle } from "shared/datastructures/arrayutils";
import { BoostZone_S } from "./weapons/boostzones";
import { CollisionManager } from "shared/core/entitycollision";
import { AttemptAction, SERVER_REGISTERED_ITEMACTIONS } from "./networking/serveritemactionlinker";
import { ItemActionLinker } from "shared/core/sharedlogic/itemactions";
import { FreeForAllRound, load_tiled_map, LobbyRound, Match, WorldInfo } from "./servermatch";

// Stop writing new info after packet is larger than this
// Its a soft cap, as the packets can be 2047 + last_packet_written_length long,
const MAX_BYTES_PER_PACKET = 2048;

/** At what cutoff do we start using the more accurate setImmediate instead of setTimeout? */
const SET_TIMEOUT_JUST_IN_CASE_BUFFER_MS = 15;

/** 
 *  AFTER A ROUND BEGINS, this is the number of ticks that a player loses authority of their position for.
 *  During this time, interpolate players positions to their target position
*/
export const ROUND_START_WAIT_SECONDS = 1.5;


/** Per client info  */
export class PlayerInformation {

    /** Unique ID to identify this connection */
    readonly connectionID: ConnectionID;

    /** milliseconds, one way trip, NOT two way */
    ping: number = 100;
    gamemode: ClientPlayState = ClientPlayState.SPECTATING;
    playerEntity: ServerPlayerEntity;

    has_voted = false;
    vote_for_server_gamemode: MatchGamemode = -1;

    constructor(connectionID: ConnectionID){
        this.connectionID = connectionID;
    }
    

    readonly personalStream = new BufferStreamWriter(new ArrayBuffer(MAX_BYTES_PER_PACKET * 2));
    readonly personalPackets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();

    // Currently only for players joining late
    readonly dirty_entities: Queue<EntityID> = new LinkedQueue<EntityID>();

    serializePersonalPackets(stream: BufferStreamWriter){
        while(this.personalPackets.size() > 0 && this.personalStream.size() < MAX_BYTES_PER_PACKET){
            const packet = this.personalPackets.dequeue();
            packet.write(stream);
        }
    }
}

enum RoundState {
    ROUND_PENDING,
    ROUND_ACTIVE,
}


export class ServerBearEngine extends BearGame<{}, ServerEntity> {
    update(dt: number): void {}
    protected onStart(): void {}
    protected onEnd(): void {}
    
    /** Ticks per second */
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
    

    // Set of all packets that should be sent to any player joining mid-game
    // Cleared at start and end of each round 
    // Packets are added here if the PacketWriter has the savePacket flag = true;

    private round_saved_packets: Queue<PacketWriter> = new LinkedQueue<PacketWriter>();

    // INSTEAD OF BELOW, JUST WRITE THE PACKET TO ALL CLIENT QUEUES
    // Packets that should only be sent to clients that are connected.
    // Packets are directly queued here, and it is processed at end of tick.
    // private immediate_packets: PacketWriter[] = [];

    public active_match: Match;
    // public active_scene: BaseScene;
    
    private queue_next_match: { mode: MatchGamemode, map: keyof typeof LevelRef} = null;
    // // private round_state: RoundState = RoundState.ROUND_PENDING;
    // // private current_gamemode: MatchGamemode = MatchGamemode.LOBBY;

    // get_current_gamemode(){
    //     return this.active_scene.gamemode;
    // }

    //private server_state: ServerGameState = ServerGameState.PRE_MATCH_LOBBY;
    // public matchIsActive(): boolean {
    //     return this.server_state === ServerGameState.ROUND_ACTIVE;
    // }

    

    // Subsystems
    public terrain: TerrainManager;
    public collision: CollisionManager;
    public world_info: WorldInfo;

    //////////////////////////////////////////////////////////////////////////////////////////
    public networked_entity_subset = this.entities.createSubset<NetworkedEntity<any>>()

    // override entities: never;
    

    // Serializes the packets in here at end of tick, sends to every player
    private currentTickGlobalPackets: PacketWriter[] = [];
    enqueueGlobalPacket(packet: PacketWriter){
        this.currentTickGlobalPackets.push(packet);
    }

    // Sends the packet direclty to client packet queues, 
    // Guarentees will not be cleared by round_end;
    // is NOT sent to players who show up late
    broadcast_packet_safe(packet: PacketWriter){
        for(const c of this.players.values()){
            c.personalPackets.enqueue(packet);
        }
    }

    enqueuePacketForClient(clientID: number, packet: PacketWriter){
        this.players.get(clientID).personalPackets.enqueue(
            packet
        );
    }

    sendToAllBut(player: PlayerInformation, packet: PacketWriter){
        for(const c of this.players.values()){
            if(c !== player){
                c.personalPackets.enqueue(packet);
            }
        }
    }


    constructor(tick_rate: number){
        super({});
        this.TICK_RATE = tick_rate;


        // Links shared entity classes
        SharedEntityServerTable.init();
        SERVER_REGISTERED_ITEMACTIONS.init();
    }

    protected initSystems(){
        this.terrain = this.registerSystem(new TerrainManager(this));
        this.collision = this.registerSystem(new CollisionManager(this));
    }



    start(socket: Server){
        this.initialize();

        this.network = new ServerNetwork(socket);

        this.network.start(
            this.onClientConnect.bind(this),
            this.onClientLeave.bind(this)
        );
        
        this.previousTickTime = Date.now();

        this.start_new_match(MatchGamemode.LOBBY, "LOBBY");

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

        clientInfo.personalPackets.enqueue(
            new DeclareCommandsPacket(commandDispatcher.autocomplete_hints())
        )

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
        this.broadcast_packet_safe(
            new OtherPlayerInfoAddPacket(clientID, clientInfo.ping, clientInfo.gamemode)
        );

        clientInfo.personalPackets.enqueue(
            new LoadLevelPacket(LevelRefLinker.NameToID(this.active_match.current_round.world_id))
        );

        // Gives the client all the data from the current level
        clientInfo.personalPackets.addAllQueue(this.round_saved_packets);

        // Tell them to create everything that is currently alive
        // The second loop updates the variables
        for(const e of this.networked_entity_subset.entities){
            clientInfo.personalPackets.enqueue(
                new RemoteEntityCreatePacket(e.constructor["SHARED_ID"], e.entityID)
            );
        }

        for(const entity of this.networked_entity_subset.entities){
            if(entity.lifetime_dirty_bits !== 0){
                clientInfo.dirty_entities.enqueue(entity.entityID);
            }
        }

        // If in lobby, spawn them
        // OTHER WISE, they will be respawned at the end of the next match
        if(this.active_match.gamemode === MatchGamemode.LOBBY){
            this.createPlayerEntity(clientInfo);
            this.entities.addEntity(clientInfo.playerEntity);
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

        this.broadcast_packet_safe(
            new OtherPlayerInfoRemovePacket(clientID)
        );

        this.broadcast_packet_safe(
            new PlayerEntityCompletelyDeletePacket(clientID)
        );
        
        // Won't do anything if they are already dead
        // this.active_scene.activePlayerEntities.remove(clientID);
    }

    
    /** If vote for the same thing twice, will turn the vote off 
     * This is triggered by player shooting the "vote" target
    */
    player_vote_start(id: number, mode: MatchGamemode){

        const p = this.players.get(id);
        if(p === undefined) {
            console.error("Unknown player voting");
            return;
        }

        if(this.active_match.gamemode !== MatchGamemode.LOBBY){
            console.log("Ignoring vote outside of lobby");
            return;
        }

        if(p.has_voted){
            if(p.vote_for_server_gamemode == mode){
                // Undos the vote
                p.has_voted = false;
                p.vote_for_server_gamemode = -1;

                p.personalPackets.enqueue(
                    new ConfirmVotePacket(mode,false)
                );
            } else {
                p.personalPackets.enqueue(
                    new ConfirmVotePacket(p.vote_for_server_gamemode,false)
                );

                p.vote_for_server_gamemode = mode;
                console.log(`Player ${id} voted for ${MatchGamemode[mode]}`)

                p.personalPackets.enqueue(
                    new ConfirmVotePacket(mode,true)
                );
            }
        } else {
            console.log(`Player ${id} voted for ${MatchGamemode[mode]}`)
            p.has_voted = true;
            p.vote_for_server_gamemode = mode;

            p.personalPackets.enqueue(
                new ConfirmVotePacket(mode,true)
            );


            if(this.clients.length > 1){
                // If every player has voted for this mode, then start the mode
                if([...this.players.values()].every(p => p.has_voted && p.vote_for_server_gamemode === mode)){

                    for(const p of this.players.values()) {
                        p.has_voted = false;
                        p.vote_for_server_gamemode = -1;
                    }

                    // For now, only INFINITE is allowed
                    this.queue_start_new_match(
                        MatchGamemode.FREE_FOR_ALL,
                        "LEVEL_ONE"
                    );
                }
            }
        }
    }

    end_match(){
        this.queue_start_new_match(MatchGamemode.LOBBY, "LOBBY");
    }

    queue_start_new_match(mode: MatchGamemode, map: keyof typeof LevelRef){
        console.log("Match starting next tick: " + MatchGamemode[mode]); 
        this.queue_next_match = {
            mode,
            map
        }
    }

    set_active_match(gamemode: MatchGamemode, level_id: number): void {

        console.log("Set active match to " + MatchGamemode[gamemode])

        const next_level_manager = {
            next_level() { 
                return LevelRefLinker.IDToName(level_id);
            }
        }

        switch(gamemode){
            case MatchGamemode.LOBBY: {
                this.active_match = new Match(this, MatchGamemode.LOBBY, LobbyRound, 10, next_level_manager, 
                    {type: MatchDurationType.N_ROUNDS, value: 5}
                );
                break; 
            }
            case MatchGamemode.FREE_FOR_ALL: {
                this.active_match = new Match(this, MatchGamemode.FREE_FOR_ALL, FreeForAllRound, 10, next_level_manager,
                    {type: MatchDurationType.N_ROUNDS, value: 5}
                );
                break;
            }

            default: AssertUnreachable(gamemode);
        }
    }

    // Clears entities, terrain, ect. Tells clients now round is starting
    /** Called by `Match` object */
    start_of_new_round(map: keyof typeof LevelRef){
        const level_id = LevelRefLinker.NameToID(map);

        // Clean up everything from last match
        this.round_saved_packets.clear();
        this.currentTickGlobalPackets = [];

        this.entities.clear();
        this.terrain.clear();
        this.collision.clear();

        const level_data = load_tiled_map(this, map);
        
        const spawn_points = shuffle([...level_data.spawn_points])

        for(let i = 0; i < this.clients.length; i++){
            const clientID = this.clients[i];
            const p = this.players.get(clientID);


            const spawn_spot = i < spawn_points.length ? spawn_points[i] : new Vec2(150 + (i * 200), 0);


            // If someone waiting to join, allow them to join
            if(p.gamemode === ClientPlayState.SPECTATING){
                this.createPlayerEntity(p);
            }

            if(p.gamemode === ClientPlayState.GHOST){
                p.gamemode = ClientPlayState.ACTIVE;

                p.personalPackets.enqueue(
                    new SetGhostStatusPacket(false)
                );

                this.broadcast_packet_safe(
                    new OtherPlayerInfoUpdateGamemodePacket(clientID,ClientPlayState.ACTIVE)
                );
            }

            // All players state are 'Active' at this point
    

            // Add back player entities to the game world
            const player = new ServerPlayerEntity(clientID,p);
            p.playerEntity = player;
            this.entities.addEntity(player);

            // this.active_scene.activePlayerEntities.set(clientID, p.playerEntity);

            p.personalPackets.enqueue(
                new StartRoundPacket(spawn_spot.x, spawn_spot.y, level_id, ROUND_START_WAIT_SECONDS)
            );

            p.playerEntity.position.set(spawn_spot);

            this.enqueueGlobalPacket(
                new PlayerEntitySpawnPacket(clientID, spawn_spot.x,spawn_spot.y)
            );
        }
    }

    // Resets everything to prepare for a new level, sends data to clients
    // Everyone who is spectating is now active
    private start_new_match(gamemode: MatchGamemode, map: keyof typeof LevelRef){

        const level_id = LevelRefLinker.NameToID(map);

        this.start_of_new_round(map);

        this.set_active_match(gamemode, level_id);
        this.active_match.start();
    }

    // Tells clients to create the player entity.
    // Sets gamemode to Active
    /** Does NOT spawn it in the game world */
    createPlayerEntity(client: PlayerInformation){
        const clientID = client.connectionID

        const player = new ServerPlayerEntity(clientID, client);

        client.gamemode = ClientPlayState.ACTIVE;
        client.playerEntity = player;


        // Tells them to spawn a local player and to start sharing position with other players
        client.personalPackets.enqueue(
            new SpawnYourPlayerEntityPacket(random_range(100, 500), 300)
        );

        // Tell others that this guy just spawned
        this.broadcast_packet_safe(
            new PlayerEntitySpawnPacket(clientID,0,0)
        );

        // Tell others to update this clients Gamemode to ACTIVE
        this.broadcast_packet_safe(
            new OtherPlayerInfoUpdateGamemodePacket(clientID,ClientPlayState.ACTIVE)
        );
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
  
    createRemoteEntity(e: NetworkedEntity<any>){
        this.networked_entity_subset.addEntity(e);
        
        const id = e.entityID;
        
        this.enqueueGlobalPacket(new RemoteEntityCreatePacket(e.constructor["SHARED_ID"], id));
    }

    createRemoteEntityNoNotify(e: NetworkedEntity<any>){
        this.networked_entity_subset.addEntity(e);
    }
    
    destroyRemoteEntity(e: NetworkedEntity<any>){

        const id = e.entityID;

        this.enqueueGlobalPacket(new RemoteEntityDestroyPacket(e.constructor["SHARED_ID"], id));

        this.networked_entity_subset.destroyEntity(e);
    }

    createItemFromPrefab(item_id: number): SBaseItem<any> {
        const raw_item_data = ITEM_LINKER.IDToData(item_id);
                
        const item_class = SharedEntityServerTable.getEntityClass(SharedEntityLinker.nameToSharedID(raw_item_data.type));
        // console.log("Creating item: ", item_class);

        //@ts-expect-error
        const item_instance = (new item_class(item_id));
        
        assert(item_instance instanceof SBaseItem, "Error! Trying to create item of class " + item_class + ". This is not a subtype of SBaseItem, which means you implemented it wrong");

        return item_instance;
    }

    givePlayerItemEntityAndDropIfHave(p: PlayerInformation, item_entity: ItemEntity){
        this.givePlayerItem(p, item_entity.item);

        
        this.destroyRemoteEntity(item_entity);
    }

    /** When no ItemEntity ever existed. Direct to player spawn */
    givePlayerItem(p: PlayerInformation, raw_item: SBaseItem<any>){
        if(p.playerEntity.item_in_hand !== null){
            this.dropPlayerItem(p)
        }

        p.playerEntity.setItem(raw_item);

        p.personalPackets.enqueue(
            new SetInvItemPacket(raw_item.item_id, raw_item)
        );

        this.enqueueGlobalPacket(
            new PlayerEntitySetItemPacket(p.connectionID, raw_item.item_id)
        );
    }

    dropPlayerItem(p: PlayerInformation): ItemEntity {
        // console.log("Dropping item");
        this.endPlayerBeam(p)

        const item = new ItemEntity(p.playerEntity.item_in_hand);

        item.pos.set(p.playerEntity.position);
        item.initial_pos.set(item.pos);

        this.createRemoteEntity(item);

        this.notifyItemRemove(p)


        p.playerEntity.clearItem();

        return item;
    }

    endPlayerBeam(player_info: PlayerInformation){
        return this.endPlayerBeam_Player(player_info.playerEntity);
    }

    endPlayerBeam_Player(playerEntity: ServerPlayerEntity){


        if(playerEntity.current_beam !== null){
            const id = playerEntity.current_beam.beam_id;
            this.entities.destroyEntity(playerEntity.current_beam);

            playerEntity.current_beam = null;

            return id;
        }

        return -1;
    }

    notifyItemRemove(p: PlayerInformation){
        p.personalPackets.enqueue(
            new ClearInvItemPacket()
        );

        this.enqueueGlobalPacket(
            new PlayerEntityClearItemPacket(p.connectionID)
        )
    }

    dmg_players_in_radius(point: Vec2, r: number, dmg: number): void {
        // for(const pEntity of this.active_scene.activePlayerEntities.values()){
        for(const pEntity of this.entities.view(ServerPlayerEntity)){
            if(Vec2.distanceSquared(pEntity.position,point) < r * r){
                pEntity.take_damage(dmg);
            }
        } 
    }


    kill_player(player_entity: ServerPlayerEntity){
        player_entity.force_set_health(0);
        player_entity.dead = true;
        
        const playerID = player_entity.connectionID;
        const connection = this.players.get(playerID);

        console.log(`Player ${playerID} died!`);

        this.active_match.current_round.dead_players.push(player_entity.client);
        this.entities.destroyEntityImmediately(player_entity.entityID);
        // this.active_scene.activePlayerEntities.remove(playerID);
        
        
        connection.gamemode = ClientPlayState.GHOST;

        // Tells the player that they are dead
        connection.personalPackets.enqueue(
            new SetGhostStatusPacket(true)
        );

        this.broadcast_packet_safe(
            new OtherPlayerInfoUpdateGamemodePacket(playerID, ClientPlayState.GHOST)
        );

        // Tells other players of this players' death
        this.broadcast_packet_safe(
            new PlayerEntityDeathPacket(playerID)
        );

        if(!this.world_info.player_death_bbox.contains(player_entity.position)){
            // Tells them to teleport to another player, is a ghost
            const other_players = this.entities.view(ServerPlayerEntity);
            const pos = other_players.length > 0 ? choose(other_players).position : new Vec2(this.world_info.map_bounds.width / 2, 0);

            connection.personalPackets.enqueue(
                new ForcePositionPacket(pos.x,pos.y)
            );


        }
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

                        const player_info = this.players.get(clientID);

                        const p = player_info.playerEntity;
                        p.position.x = stream.getFloat32();
                        p.position.y = stream.getFloat32();

                        p.mouse.x = stream.getFloat32();
                        p.mouse.y = stream.getFloat32();


                        p.animation_state = stream.getUint8();
                        p.flipped = stream.getBool();

                        p.mousedown = stream.getBool();
                        const isFDown = stream.getBool();
                        const isQDown = stream.getBool();


                        p.setLookDirection();

                        // If round not active, don't even process item picking up
                        // if(this.server_state !== ServerGameState.ROUND_ACTIVE) continue;

                        //Drop item
                        if(isQDown){
                            if(p.item_in_hand !== null){
                                const item = this.dropPlayerItem(player_info);
                                item.velocity.set(Vec2.subtract(p.mouse,p.position).extend(17));
                                item.mode = ItemEntityPhysicsMode.BOUNCING;
                            }
                        }
                        
                        //Pick up item
                        if(isFDown){
                            for(const item_entity of this.entities.entities){
                                if(item_entity instanceof ItemEntity){
                                    if(Vec2.distanceSquared(p.position, item_entity.pos) < 50**2){

                                        

                                        if(item_entity.item.activation_type === ItemActivationType.GIVE_ITEM){
                                            this.givePlayerItemEntityAndDropIfHave(player_info,item_entity);
                                        } else if (item_entity.item.activation_type === ItemActivationType.INSTANT){
                                            item_entity.item.do_action(this.players.get(clientID));
                                            this.destroyRemoteEntity(item_entity);
                                        }
                                        

                                        break;
                                    }
                                }
                            }
                        }

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

                    case ServerBoundPacket.NEW_AUTO_REQUEST_ITEM_ACTION: {
                        const action_id = stream.getUint8();
                        const client_action_id = stream.getUint32();

                        const net_tuple_def = ItemActionLinker.IDToData(action_id).serverbound.argTypes;
                
                        //@ts-expect-error
                        const arg_data = DeserializeTuple(stream, net_tuple_def);

                        const func = SERVER_REGISTERED_ITEMACTIONS.id_to_class_map.get(action_id);
                        
                        //@ts-expect-error
                        const inst = (new func(this, this.players.get(clientID), client_action_id));
                        //@ts-ignore
                        (inst as AttemptAction<any>).attempt_action(...arg_data);

                        break;
                    }

                    default: AssertUnreachable(type);
                }
            }
        }
    }

    private writeToNetwork(){

        // Get entities marked dirty
        const entitiesToSerialize: NetworkedEntity<any>[] = []

        for(const entity of this.networked_entity_subset.entities){ 
            if(entity.dirty_bits !== 0){
                entitiesToSerialize.push(entity);
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

                    stream.setFloat32(player.look_dir.x);
                    stream.setFloat32(player.look_dir.y);

                    stream.setUint8(player.animation_state);
                    stream.setBool(player.flipped);
                }
            }
            
            // This loop is only called if the client has joined late
            if(connection.dirty_entities.size() !== 0){
                while(connection.dirty_entities.size() > 0){
                    // This checks for a likely buffer overflow
                    if(stream.size() < MAX_BYTES_PER_PACKET){
                        const entity_id = connection.dirty_entities.dequeue();

                        const e = this.networked_entity_subset.getEntity(entity_id);
                        if(e !== null){
                            stream.setUint8(GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE);
                            SharedEntityServerTable.serialize_with_dirty_bits(stream, e, e.lifetime_dirty_bits);
                        }
                    } else {
                        break;
                    }
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
                this.round_saved_packets.enqueue(packet);
            }
        }
        
        for(const e of entitiesToSerialize){
            e.lifetime_dirty_bits |= e.dirty_bits;
            e.dirty_bits = 0;
        }

        this.currentTickGlobalPackets = [];

        // console.log(this.tick,Date.now()  - this.previousTick);
    }




    private _boundLoop = this.loop.bind(this);

    // private __useless_calls_test = 0;

    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if(this.previousTickTime + (1000 / this.TICK_RATE) <= now){
            
            
            // console.log(this.__useless_calls_test)
            // this.__useless_calls_test = 0;
            const dt = 1 / this.TICK_RATE;

            this.tick += 1;
            this.totalTime += dt;
            // Think about whether the time should be at beginning or end of tick
            this.referenceTick = this.tick;
            this.referenceTime = BigInt(now);

            this.readNetwork();


            // Round logic
            if(this.clients.length < 2){
                if(this.active_match.gamemode !== MatchGamemode.LOBBY){
                    this.end_match();
                }
            }

            for(let i = 0; i < 60/this.TICK_RATE; i++){
                this.collision.update(dt/(60/this.TICK_RATE));
                this.entities.update(dt/(60/this.TICK_RATE));
                if(this.active_match.update_match){
                    this.active_match.update(); 
                    if(this.active_match.match_over){
                        console.log("MATCH IS OVER")
                        this.active_match.update_match = false;
                        this.queue_start_new_match(MatchGamemode.LOBBY, "LOBBY");
                    }
                }

               
            }
            // this.updateScenes(dt);

            if(this.queue_next_match !== null){
                this.start_new_match(this.queue_next_match.mode, this.queue_next_match.map);
                this.queue_next_match = null;
            }


            this.writeToNetwork()

            // console.log(Date.now() - now);

            this.previousTickTime = now
        }
    
        // if we are more than 16 milliseconds away from the next tick
        // This avoids blocking like in a while loop. while keeping the timer somewhat accurate
        if(now - this.previousTickTime < (1000 / this.TICK_RATE) - SET_TIMEOUT_JUST_IN_CASE_BUFFER_MS) {

            setTimeout(this._boundLoop) // not accurate to the millisecond
        } else {
            setImmediate(this._boundLoop) // ultra accurate, sub millisecond
            // this.__useless_calls_test++;
        }
    }
}


