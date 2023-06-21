import { AssertUnreachable } from "shared/misc/assertstatements";
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { EntitySystem, NULL_ENTITY_INDEX, StreamReadEntityID } from "shared/core/entitysystem";
import { NetCallbackTupleType, NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, SharedEntityLinker } from "shared/core/sharedlogic/networkschemas";
import { ClientBoundImmediate, ClientBoundSubType, GamePacket, ServerBoundPacket, ServerImmediatePacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { InterpolatedVarType, SharedEntityClientTable } from "./cliententitydecorators";
import { RemoteLocations } from "./remotecontrol";
import { CallbackNetwork, NetworkSettings } from "./clientsocket";
import { Entity } from "../entity";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AnimationState, Player, PlayerState, RemotePlayer } from "../../gamelogic/player";
import { abs, ceil, DEG_TO_RAD, floor } from "shared/misc/mathutils";
import { LinkedQueue } from "shared/datastructures/queue";
import { BearEngine, NetworkPlatformGame } from "../bearengine";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { DummyLevel } from "../gamelevel";
import { Vec2 } from "shared/shapes/vec2";
import { CLIENT_REGISTERED_ITEMACTIONS, PredictAction, RequestActionPacket } from "./clientitemactionlinker"

import { ClientPlayState, MatchGamemode } from "shared/core/sharedlogic/sharedenums"
import { SparseSet } from "shared/datastructures/sparseset";
import { Deque } from "shared/datastructures/deque";
import { ITEM_LINKER } from "shared/core/sharedlogic/items";
import { BeamEffect_C, ForceFieldEffect_C, ModularProjectileBullet, ShootHitscanWeapon_C, ShootProjectileWeapon_C, ShootShotgunWeapon_C } from "../clientitems";
import { Line } from "shared/shapes/line";
import { EmitterAttach } from "../particles";
import { PARTICLE_CONFIG } from "shared/core/sharedlogic/sharedparticles";
import { BeamActionType, HitscanRayEffects, ItemActionAck, SHOT_LINKER } from "shared/core/sharedlogic/weapondefinitions";
import { DeserializeTuple, DeserializeTypedArray, DeserializeTypedVar, netv, SharedTemplates } from "shared/core/sharedlogic/serialization";
import { Trie } from "shared/datastructures/trie";
import { LevelRefLinker } from "shared/core/sharedlogic/assetlinker";
import { create_text_popup, LabelWidget, WidgetAlphaTween } from "../../ui/widget";
import { ItemActionDef, ItemActionLinker } from "shared/core/sharedlogic/itemactions";
import { choose } from "shared/datastructures/arrayutils";

class ClientInfo {
    uniqueID: number;
    ping: number;
    name: string;
    gamemode: ClientPlayState;

    constructor(uniqueID: number, ping: number, name: string, gamemode: ClientPlayState){
        this.uniqueID = uniqueID;
        this.ping = ping;
        this.name = name;
        this.gamemode = gamemode;
    }

    updateGamemodeString(): string {
        return `Client ${this.uniqueID} updated gamemode to ${ClientPlayState[this.gamemode]}`;
    }

    toString(): string {
        return `Client ${this.uniqueID}: [ping: ${this.ping}, gamemode: ${ClientPlayState[this.gamemode]}]`;
    }
}

interface BufferedPacket {
    buffer: BufferStreamReader;
    id: number;
}


const MS_PER_PING = 2500;

export class NetworkSystem extends Subsystem<NetworkPlatformGame> {


    private next_local_action_id = 0;
    
    getNewLocalActionID(){
        return this.next_local_action_id++;
    }

    private pending_ack_actions = new Map<number,PredictAction<any,any>>();



    isConnected(){
        return this.network.CONNECTED;
    }

    private network: CallbackNetwork;
    /** Packets from the server are queued here */
    private packets = new LinkedQueue<BufferedPacket>();
    private sendStream = new BufferStreamWriter(new ArrayBuffer(256));
    private remoteFunctionCallMap = new Map<keyof RemoteFunction,keyof NetworkSystem>();


    private stagePacketsToSerialize: PacketWriter[] = [];
    private generalPacketsToSerialize: PacketWriter[] = [];

    ticks_into_round = 0;
    ticks_to_gain_authority = 0;

    public remotelocations = this.addQuery(RemoteLocations);

    

    /** Set of all other clients */
    public otherClients = new SparseSet<ClientInfo>(256);

    remotePlayerEntities: Map<number, RemotePlayer> = new Map();


    // 
    remoteEntities: Map<number, Entity> = new Map();
    networked_entity_subset = this.game.entities.createSubset();


    public readonly command_autocomplete = {
        all_commands: new Trie(),
        command_arguments: new Map<string, Trie[]>()
    }



    // Unique identifier. Set upon first connection to server
    public MY_CLIENT_ID = -1;

    public currentPlayState: ClientPlayState = ClientPlayState.SPECTATING;


    public ALLOWED_TO_CONNECT = true;

    public SERVER_IS_TICKING: boolean = false;
    private SERVER_SEND_RATE: number = -1;

    // These are used to calculate the current tick the server is sending, received in INIT packet
    private REFERENCE_SERVER_TICK_ID: number = 0;
    private REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds, adjusted on ping packets */
    private CLOCK_DELTA = 0;

    private _serverTime = 0;
    currentServerTime(): number { return this._serverTime; }
    
    // The 
    private _serverTick = 0;
    currentServerTick(): number { return this._serverTick; }

    // Generous, default ping, milliseconds
    // MAYBE: set it to -1 and don't start ticking until we actually know it. Right now it starts ticking and then some time later the ping is adjusted
    private ping: number = 100;

    /** MILLISECONDS,
     * Used to adjust the currentTick we should simulate, used for interpolation. 
     * In effect, hold onto info for this long before simulating them 
     * In practice, it combats jitter in packet receiving times (even though server sends at perfect interval, we don't receive them in that same perfect interval)
     * Experiment with making this lower
    */
    private dejitterTime = 50;


    // Calculating bytes/second processed from network. Keeps only stuff from the last second.
    // Use priority queue to make sure nothing from more than a second ago is counted 
    private readonly byteAmountReceived: Deque<{bytes:number, time: number}> = new Deque();
    bytesPerSecond = 0;
    
    

    // Predicted values exist here while shot awaiting acknowledgement from the server
    public readonly beamIDToEntity: Map<number, BeamEffect_C> = new Map();
    

    constructor(engine: NetworkPlatformGame, settings: NetworkSettings){
        super(engine);
        this.network = new CallbackNetwork(settings, this.onmessage.bind(this));
    }

    connect(){
        this.network.connect();
    }

    quit_server(){
        this.next_local_action_id = 0;
        this.packets.clear();
        this.sendStream.clear_to_zero();
        this.stagePacketsToSerialize = [];
        this.generalPacketsToSerialize = [];

        this.otherClients.clear();
        this.remotePlayerEntities.clear();
        this.remoteEntities.clear();

        this.networked_entity_subset.clear();

        this.MY_CLIENT_ID = -1;

        this.currentPlayState = ClientPlayState.SPECTATING;

        this.SERVER_IS_TICKING = false;

        this.byteAmountReceived.clear();
        this.bytesPerSecond = 0;

        this.beamIDToEntity.clear();
        this.pending_ack_actions.clear();



        this.network.disconnect();
    }



    private onmessage(buffer: ArrayBuffer){

        const timeReceived = Date.now();

        this.byteAmountReceived.pushRight({
            bytes: buffer.byteLength,
            time: timeReceived
        });

        const stream = new BufferStreamReader(buffer);

        const subtype: ClientBoundSubType = stream.getUint8();

        switch(subtype){
            case ClientBoundSubType.IMMEDIATE: {
                const immediate: ClientBoundImmediate = stream.getUint8();

                switch(immediate){
                    case ClientBoundImmediate.PONG: this.calculatePong(stream); break;
                    default: AssertUnreachable(immediate);
                }
                break;
            }
            case ClientBoundSubType.QUEUE: {
                // Starts with Tick number, then jumps straight into subpackets
                const id = stream.getUint16();
                // console.log("Received: " + id)
                this.packets.enqueue({ id: id, buffer: stream });
                // console.log("Size of queue: " + this.packets.size()) 
                break;
            }
            default: AssertUnreachable(subtype);
        }
    }

    private sendPing(){
        // Sends unix time stamp in ms 
        const stream = new BufferStreamWriter(new ArrayBuffer(10));

        stream.setUint8(ServerPacketSubType.IMMEDIATE);
        stream.setUint8(ServerImmediatePacket.PING);
        stream.setBigInt64(BigInt(Date.now()));

        this.network.send(stream.getBuffer());
    }

    init(): void {
        // Put it pretty far in the past so forces it to calculate
        this.timeOfLastPing = Date.now() - 1000000;

        // Link shared entity classes
        SharedEntityClientTable.init();


        // Link remote function calls 
        let remotefunctiondata = NetworkSystem["REMOTE_FUNCTION_REGISTRY"] as RemoteFunctionListType;
        if(remotefunctiondata === undefined) { 
            console.log("No remote functions defined")
            remotefunctiondata = [];
        }
        // Could do this conversion directly in the decorator, and just make this an index in array not a map
        for(const remotefunction of remotefunctiondata){
            this.remoteFunctionCallMap.set(remotefunction.remoteFunctionName, remotefunction.methodName)
        }
        

        CLIENT_REGISTERED_ITEMACTIONS.init();

    }

    // This entityID is from the network, and doesn't contain the version number
    private createAutoRemoteEntity(sharedID: number, remoteEntityID: EntityID): Entity {
        const _class = SharedEntityClientTable.getEntityClass(sharedID);

        //@ts-expect-error
        const e = new _class();

        // Adds it to the scene
        this.remoteEntities.set(remoteEntityID, e);
        this.networked_entity_subset.addEntity(e);

        return e;
    }

    private calculatePong(stream: BufferStreamReader){
        // bigint64 : the unix timestamp I sent
        // bigint64 : server time stamp
        const originalStamp = stream.getBigInt64();
        const serverStamp = stream.getBigInt64();

        const currentTime = BigInt(Date.now());

        const pingThisTime = ceil(Number(currentTime - originalStamp) / 2);
        /*  TODO: implement some sort of smoothing of the ping. Sample it multiple times
            Because frameToGet depends on this.ping, constantly re-adjusting ping will cause jitter in game whenever receive pong packet. 
            
            If becomes noticible, calculate ping over many frames and take average to stand in for ping when calculating value.
                and, if this value doesn't change enough, then don't bother jittering stuff, or 
                slowly interpolate that value to the real one so it's a smooth transition    
        */

        if(abs(this.ping - pingThisTime) > 4){
            this.ping = pingThisTime;
        }
        if(this.ping < 0) console.log("Ping is negative. How") 
        if(this.ping <= 0) this.ping = 1;


        // This method assumes latency is equal both ways
        const delta = serverStamp - currentTime + BigInt(this.ping);

        // LOCAL TIME + CLOCK_DELTA === TIME_ON_SERVER
        this.CLOCK_DELTA = Number(delta);
    }

    private timeOfLastPing = Date.now(); 


    private spawnLocalPlayer(x: number, y: number){
        const p = (this.game.player = new Player());

        console.log("Spawned local player");

        this.game.entities.addEntity(p);

        p.x = x;
        p.y = y;
    }


    // @ts-expect-error
    request_item_action<E extends keyof typeof ItemActionDef>(name: E, action_object: PredictAction<E,any>,...data: NetCallbackTupleType<typeof ItemActionDef[E]["serverbound"]>){
        const new_action_id = this.getNewLocalActionID();
        action_object.local_action_id = new_action_id;

        this.pending_ack_actions.set(new_action_id,action_object);

        
        // Write to the packet stream with the tuple of data.

        this.enqueueStagePacket(
            //@ts-expect-error
            new RequestActionPacket(name, new_action_id, data)
        );
    }


    /**  Read from network, apply packets */
    readPackets(): void {
        if(this.network.CONNECTED && this.ALLOWED_TO_CONNECT){

            this.ticks_into_round++;

            const now = Date.now();

            this._serverTime = now + this.CLOCK_DELTA;
            this._serverTick = this.calculateCurrentServerTick();

            // Send ping packet periodically
            if(now >= this.timeOfLastPing + MS_PER_PING){
                this.sendPing();
                this.timeOfLastPing = now;
            }


            // Calculating bytes per second
            while(!this.byteAmountReceived.isEmpty() && this.byteAmountReceived.peekLeft().time < (now - 1000)){
                this.byteAmountReceived.popLeft();
            }

            if(!this.byteAmountReceived.isEmpty()){
                if(this.byteAmountReceived.size() === 1){
                    this.bytesPerSecond = this.byteAmountReceived.peekLeft().bytes;
                } else {
                    
                    let sum = 0;
                    for(const value of this.byteAmountReceived){
                        sum += value.bytes;
                    }
                    // const dt = this.byteAmountReceived.peekRight().time - this.byteAmountReceived.peekLeft().time;

                    // Amount of bytes received in the last second
                    this.bytesPerSecond = sum;// / (dt / 1000);
                }
            } else {
                this.bytesPerSecond = 0;
            }


            let _debug_current_packet_type: GamePacket;
            let _debug_last_packet_type: GamePacket = -1;

            const packets = this.packets;
            while(!packets.isEmpty()){

                const packet = packets.dequeue();
                const frame = packet.id;
                const stream = packet.buffer;

                while(stream.hasMoreData()){
                    const type: GamePacket = stream.getUint8();

                    _debug_current_packet_type = type;
                    
                    // console.log(GamePacket[type])

                    switch(type){
                        case GamePacket.INIT: {
                            
                            const hash = stream.getBigUint64();

                            if(hash !== NETWORK_VERSION_HASH){
                                console.log("%c Network protocol incompatible with server! ", "background: #FFA500; color: #000000");
                                
                                this.ALLOWED_TO_CONNECT = false;
                                
                                create_text_popup(this.game, "Network protocol incompatible with server", 50);

                                this.network.disconnect();
                                return;
                            }

                            const rate = stream.getUint8();
                            this.SERVER_SEND_RATE = rate;

                            // These may desync over time. Maybe resend them every now and then if it becomes an issue?
                            this.REFERENCE_SERVER_TICK_TIME = stream.getBigUint64();
                            this.REFERENCE_SERVER_TICK_ID = stream.getUint16();
                            this.MY_CLIENT_ID = stream.getUint8();

                            console.log("My client ID is: " + this.MY_CLIENT_ID);
                            break;
                        }
                        case GamePacket.SERVER_IS_TICKING: {
                            this.SERVER_IS_TICKING = true;
                            const tick = stream.getUint16(); // Reads this number so stream isn't broken
                            break;

                        }
                        // Other player connected to server
                        case GamePacket.OTHER_PLAYER_INFO_ADD: {
                            const uniqueID = stream.getUint8();
                            const ping = stream.getUint16();
                            const gamemode: ClientPlayState = stream.getUint8();

                            

                            // Don't add self
                            if(this.MY_CLIENT_ID !== uniqueID){
                                const newClient = new ClientInfo(uniqueID,ping,"",gamemode);

                                console.log("Create other client: " + newClient.toString());

                                this.otherClients.set(uniqueID, newClient);
                            }

                            break;
                        }
                        // Other player disconnected
                        case GamePacket.OTHER_PLAYER_INFO_REMOVE: {
                            const uniqueID = stream.getUint8();

                            
                            const i = this.otherClients.get(uniqueID);
                            if(i !== null){
                                console.log("Player disconnected: " + i.toString());

                                this.otherClients.remove(uniqueID);
                            }
                            
                            break;
                        }
                        case GamePacket.OTHER_PLAYER_INFO_GAMEMODE: {
                            const uniqueID = stream.getUint8();
                            const gamemode: ClientPlayState = stream.getUint8();

                            const client = this.otherClients.get(uniqueID);

                            if(uniqueID === this.MY_CLIENT_ID){
                                continue;
                            }

                            if(client === null) { 
                                console.log("GAMEMODE FOR UNKNOWN PLAYER");
                                continue;
                            }

                            client.gamemode = gamemode;
                            console.log(client.updateGamemodeString());

                            break;
                        }
                        case GamePacket.OTHER_PLAYER_INFO_PING: {
                            const uniqueID = stream.getUint8();
                            const ping = stream.getUint16()

                            const client = this.otherClients.get(uniqueID);

                            if(client === null) { 
                                console.log("PING FOR UNKNOWN PLAYER");
                                continue;
                            }

                            client.ping = ping;
                            
                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_CREATE: {
                            const sharedClassID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);

                            // console.log("CREATE: ", sharedClassID, " ", entityID);

                            const check = this.remoteEntities.get(entityID);


                            if(check !== undefined) throw new Error("Entity already exists, " + SharedEntityClientTable.getEntityClass(sharedClassID).name + ".... alive entity " + check.toString() + "exists");

                            this.createAutoRemoteEntity(sharedClassID,entityID);

                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE:{

                            const SHARED_ID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);

                            // console.log("UPDATE, ", SHARED_ID, " ", entityID);

                            let entity = this.remoteEntities.get(entityID);

                            if(entity === undefined){
                                // Will try to create the entity for now, but we missed the REMOTE_ENTITY_CREATE packet clearly
                                console.log(`Cannot find entity ${entityID}, will create`);
                                entity = this.createAutoRemoteEntity(SHARED_ID,entityID);

                            }

                            // console.log("CHANGING VAR: " + entityID + " at frame " + frame);

                            SharedEntityClientTable.deserialize(stream, frame, SHARED_ID, entity);

                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_EVENT: {
                            
                            const SHARED_ID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);
                            const eventID = stream.getUint8();

                            let entity = this.remoteEntities.get(entityID);

                            if(entity === undefined){
                                console.log("Event for unknown entity. Ignoring")
                                SharedEntityClientTable.readThroughRemoteEventStream(stream, SHARED_ID, eventID, entity)
                                // Will try to create the entity for now, but we missed the REMOTE_ENTITY_CREATE packet clearly
                                continue;
                                console.log(`Cannot find entity ${entityID}, will create`);
                                entity = this.createAutoRemoteEntity(SHARED_ID,entityID)
                                
                            }

                            SharedEntityClientTable.callRemoteEvent(stream, SHARED_ID, eventID, entity);
                            
                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_DELETE: {
                            const SHARED_ID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);

                            console.log("Deleting remote entity")

                            const entity = this.remoteEntities.get(entityID);

                            if(entity !== undefined){
                                this.remoteEntities.delete(entityID);
                                this.networked_entity_subset.destroyEntity(entity);
                            } else {
                                console.log("Attempting to delete entity that does not exist")
                            }
                            
                            break;
                        }
                        case GamePacket.REMOTE_FUNCTION_CALL:{
                            const functionID = stream.getUint8();
                            const functionName = RemoteFunctionLinker.getStringFromID(functionID)

                            const methodOfThisObject = this.remoteFunctionCallMap.get(functionName);

                            RemoteFunctionLinker.callRemoteFunction(functionName, stream, this, methodOfThisObject);
                            
                            break;
                        }
                        case GamePacket.LOAD_LEVEL: {
                            // Called when initially join
                            const level = LevelRefLinker.IDToData(stream.getUint8());

                            this.game.endCurrentLevel();
                            this.game.loadLevel(new DummyLevel(this.game, level));
                            break;
                        }

                        case GamePacket.SPAWN_YOUR_PLAYER_ENTITY: {
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            this.currentPlayState = ClientPlayState.ACTIVE;

                            this.spawnLocalPlayer(x,y);

                            this.game.center_camera();
                            
                            break;
                        }

                        case GamePacket.SET_GHOST_STATUS: {
                            const ghost = stream.getBool();

                            if(ghost){
                                this.currentPlayState = ClientPlayState.GHOST;
                               
                                this.game.player.clearItem();
                            } else {
                                this.currentPlayState = ClientPlayState.ACTIVE;
                            }
                            
                            this.game.player.setGhost(ghost);
                            
                            break;
                        }

                        case GamePacket.START_MATCH: {
                            const mode: MatchGamemode = stream.getUint8();

                            switch(mode){
                                case MatchGamemode.FREE_FOR_ALL: {
                                    create_text_popup(this.game, "Free For All!!", 102);
                                    break;
                                }
                                case MatchGamemode.LOBBY: {
                                    create_text_popup(this.game, "Lobby", 102);
                                    break;
                                }
                                default: AssertUnreachable(mode);
                            }
                            break;
                        }

                        case GamePacket.END_MATCH: {
                            const mode: MatchGamemode = stream.getUint8();
                            const winner_id = stream.getUint8();

                            if(mode === MatchGamemode.FREE_FOR_ALL){
                                create_text_popup(this.game, String(winner_id) + " wins it all!", 120)
                            }
                            
                            break;
                        }

                        case GamePacket.START_ROUND: {
                            console.log("New round begun");
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();
                            const level = LevelRefLinker.IDToData(stream.getUint8());
                            const seconds_until_start = stream.getFloat64();


                            this.ticks_into_round = 0;
                            this.ticks_to_gain_authority = seconds_until_start * 60;
                            this.stagePacketsToSerialize = [];

                            // maybe force deletion immediately?
                            // Doesn't really matter as I clear the remoteEntity map which breaks all links between network and the local entity
                            this.networked_entity_subset.clear();
                            this.remoteEntities.clear();

                            this.beamIDToEntity.forEach(v => v.destroy());
                            this.beamIDToEntity.clear();

                            // FOR NOW, fail all active actions.
                            this.pending_ack_actions.forEach(a => a.ack_fail(ItemActionAck.INVALID_STATE));
                            this.pending_ack_actions.clear();


                            this.currentPlayState = ClientPlayState.ACTIVE;


                            this.game.endCurrentLevel();
                            this.game.loadLevel(new DummyLevel(this.game, level));


                            // If can start playing now. 
                            // FOR NOW ALWAYS WILL BE TRUE
                            if(this.currentPlayState === ClientPlayState.ACTIVE){
                                this.game.player.clearItem();
                                this.game.player.setGhost(false);

                                this.game.player.health = 100;
                                this.game.player.authority_over_position = false;

                                this.game.player.start_death_animation();
                                this.game.player.start_revive_animation(seconds_until_start);

                                this.game.player.force_position({x, y});
                                this.game.player.velocity.setXY(0, 0);
                            }

                            for(const p of this.remotePlayerEntities.values()){
                                p.draw_item.clear();
                                p.health = 100;

                                p.start_revive_animation(seconds_until_start);
                            }


                            break;
                        }
                        case GamePacket.END_ROUND: {
                            console.log("A winner has been announced!");
                            
                            this.stagePacketsToSerialize = [];

                            const ticks_until_next_round = stream.getUint16();

                            const length = stream.getUint8();

                            const order: number[] = [];
                            for(let i = 0; i < length; i++){
                                order.push(stream.getUint8());
                            }
                            
                            if(order.length > 0){
                                const winnerID = order[0];

                                const pEntity = this.MY_CLIENT_ID === winnerID ? this.game.player : this.remotePlayerEntities.get(winnerID);

                                const emitter = new EmitterAttach(pEntity,"ROUND_WINNER", "particle.png");

                                this.game.entities.addEntity(emitter);

                                create_text_popup(this.game, choose(simple_win_strings).replace("_", String(winnerID)), 120)
                            }

                            break;
                        }

                        case GamePacket.DECLARE_COMMANDS: {
                            const command_array = DeserializeTypedArray(stream, netv.template(SharedTemplates.COMMANDS.format))

                            for(const command of command_array){
                                this.command_autocomplete.all_commands.insert(command.name);
                                this.command_autocomplete.command_arguments.set(command.name, command.args.map(c => (new Trie()).insertAll(c)))
                            }

                            break;
                        }

                        case GamePacket.PLAYER_ENTITY_SPAWN:{
                            // [playerID: uint8, x: float32, y: float32]

                            const pID = stream.getUint8();
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            if(pID === this.MY_CLIENT_ID){
                                console.log("Ignore spawn player for self");
                                continue;
                            }


                            if(this.otherClients.get(pID) === null){
                                console.log("Trying to spawn an entity for a client we don't know about");
                                continue;
                            }


                            // If already exists locally, make visible and teleport to position 
                            const other_player = this.remotePlayerEntities.get(pID);
                            if(other_player !== undefined){

                                other_player.make_visible();

                                //

                                other_player.position.set({x,y});
                                
                                // Interpolate
                                // other_player.start_revive_animation(1);
                                continue;
                            }

                            console.log("Creating other player entity, id: " + pID)

                            const entity = new RemotePlayer(pID);
                            entity.x = x;
                            entity.y = y;

                            this.remotePlayerEntities.set(pID, entity);
                            this.game.entities.addEntity(entity);
                            
                            break;
                        }
                        case GamePacket.PLAYER_ENTITY_DEATH:{
                            // Find correct entity
                            const pId = stream.getUint8();

                            if(pId === this.MY_CLIENT_ID){
                                continue;
                            }

                            const e = this.remotePlayerEntities.get(pId);
                            if(e !== undefined){
                                console.log(`Player ${pId} is now a ghost!`);

                                e.play_death_animation();

                                // this.remotePlayerEntities.delete(pId);
                                // this.game.entities.destroyEntity(e);
                            }
                            break;
                        }
                        
                        case GamePacket.PLAYER_ENTITY_COMPLETELY_DELETE: {
                            const pId = stream.getUint8();

                            if(pId === this.MY_CLIENT_ID){
                                continue;
                            }

                            const e = this.remotePlayerEntities.get(pId);
                            if(e !== undefined){
                                console.log(`Completely deleting player ${pId}`);

                                this.remotePlayerEntities.delete(pId);
                                this.game.entities.destroyEntity(e);
                            }
                            
                            break;
                        }

                        case GamePacket.PLAYER_ENTITY_TAKE_DAMAGE: {

                            const player_id = stream.getUint8();
                            const new_health = stream.getUint8();
                            const dmg = stream.getUint8();

                            if(player_id === this.MY_CLIENT_ID){
                                this.game.player.health = new_health;
                                continue;
                            }

                            // Find correct entity
                            const e = this.remotePlayerEntities.get(player_id);
                            if(e === undefined){
                                console.log("Unknown player entity health packet");
                                continue;
                            }

                            // if(e.health !== new_health){
                            const emitter = new EmitterAttach(e,"HIT_SPLAT", "particle.png", Vec2.random(10));
                            this.game.entities.addEntity(emitter);
                            e.health = new_health;
                            // }
                            


                            break;
                        }

                        case GamePacket.PLAYER_ENTITY_POSITION:{
                           
                            const player_id = stream.getUint8();
                    
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            const dir_x = stream.getFloat32();
                            const dir_y = stream.getFloat32();

                            const state: AnimationState = stream.getUint8();
                            const flipped = stream.getBool();

                            if(player_id === this.MY_CLIENT_ID){
                                continue;
                            }

                            // Find correct entity
                            const e = this.remotePlayerEntities.get(player_id);
                            if(e === undefined){
                                console.log("Unknown player entity data");
                                continue;
                            }

                            // console.log(`Player data for ${playerID}, at tick ${frame}`)

                            e.locations.addPosition(frame, x,y);
                            e.setState(state,flipped);
                            e.look_angle.buffer.addValue(frame, new Vec2(dir_x, dir_y));

                            
                            break;
                        }
                        
                        case GamePacket.PLAYER_ENTITY_SET_ITEM: {
                            
                            const playerID = stream.getUint8();
                            const item_id = stream.getUint8();

                        
                            if(playerID === this.MY_CLIENT_ID) continue;
                            
                            const e = this.remotePlayerEntities.get(playerID);
                            
                            if(e === undefined){
                                console.log("Unknown player entity data");
                                continue;
                            }

                            const item_data = ITEM_LINKER.IDToData(item_id);

                            e.draw_item.setItem(item_data.item_sprite);

                            break;
                        }
                        case GamePacket.PLAYER_ENTITY_CLEAR_ITEM: {
                            const playerID = stream.getUint8();
                        
                            if(playerID === this.MY_CLIENT_ID) continue;

                            const e = this.remotePlayerEntities.get(playerID);
                            
                            if(e === undefined){
                                console.log("Unknown player entity data");
                                continue;
                            }

                            e.draw_item.clear();

                            break;
                        }

                        case GamePacket.TERRAIN_CARVE_CIRCLE: {
                            const terrain = this.game.terrain;
                            const x = stream.getFloat64();
                            const y = stream.getFloat64();
                            const r = stream.getInt32();
                            
                            terrain.carveCircle(x, y, r);

                            this.engine.renderer.addEmitter("assets/flower.png", PARTICLE_CONFIG["TERRAIN_EXPLOSION"], x, y);
                            
                            break;
                        }

                        case GamePacket.FORCE_POSITION: {
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            this.game.player.force_position({x,y});

                            break;
                        }

                        case GamePacket.SET_INV_ITEM: {
                            const item_id = stream.getUint8();

                            const item_data = ITEM_LINKER.IDToData(item_id);
                            
                            const item_class = SharedEntityClientTable.getEntityClass(SharedEntityLinker.nameToSharedID(item_data.type));

                            // console.log(item_class)

                            //@ts-expect-error
                            const item_instance = (new item_class(item_id));


        
                            const shared_id = SharedEntityLinker.nameToSharedID(item_data.type);

                             
                            const variableslist = SharedEntityClientTable.FINAL_REGISTERED_NETWORKED_ENTITIES[shared_id].varDefinition;

                            for(const variableinfo of variableslist){
                                // console.log(variableinfo.variabletype);
                                const value = DeserializeTypedVar(stream, variableinfo.variabletype);

                                item_instance[variableinfo.variablename] = value
                                
                                if(variableinfo.recieveFuncName !== null){
                                    item_instance[variableinfo.recieveFuncName](value);
                                }
                            }

                            
                            // console.log("Created item:" + item_instance)

                            if(this.currentPlayState === ClientPlayState.ACTIVE){
                                this.game.player.setItem(item_instance, item_data.item_sprite);
                            }
                            
                            break;
                        }

                        case GamePacket.CLEAR_INV_ITEM: {
                            
                            this.game.player.clearItem();

                            break;
                        }

                        case GamePacket.CONFIRM_VOTE: {
                            const mode: MatchGamemode = stream.getUint8();
                            const enabled = stream.getBool();

                            
                            const all_t = this.game.terrain.get_terrain_by_tag("vote")
                            for(const t of all_t){
                                if(enabled){
                                    console.log("set")
                                    t.color.set_from_hex(0xFFD700);                                    
                                } else {
                                    console.log("no")
                                    t.reset_color();
                                }

                                this.game.terrain.mesh_events.dispatch("on_mutate", t);
                            }


                            break;
                        }

                        case GamePacket.NEW_CLIENT_DO_ITEM_ACTION: {

                            const creator_id = stream.getUint8();
                            const action_id = stream.getUint8();
                            const create_server_tick = stream.getFloat32();

                            const net_tuple_def = ItemActionLinker.IDToData(action_id).clientbound.argTypes;
                
                            //@ts-expect-error
                            const arg_data = DeserializeTuple(stream, net_tuple_def);

                            if(creator_id === this.MY_CLIENT_ID){
                                console.error("Received DO_ACTION for an action I initiated, " + ItemActionLinker.IDToName(action_id));
                            }

                            const func = CLIENT_REGISTERED_ITEMACTIONS.id_to_function_map.get(action_id);
                            func(creator_id, this.game, ...arg_data);

                            break;
                        }
                        case GamePacket.NEW_ACK_ITEM_ACTION: {
                            
                            const action_id = stream.getUint8();
                            const ack_code: ItemActionAck = stream.getUint8();
                            const create_server_tick = stream.getFloat32();
                            const local_action_id = stream.getUint32();

                            
                            const net_tuple_def = ItemActionLinker.IDToData(action_id).clientbound.argTypes;
                            
                            const predicted_action = this.pending_ack_actions.get(local_action_id);
                            this.pending_ack_actions.delete(local_action_id);

                            if(ack_code === ItemActionAck.SUCCESS){
                                //@ts-expect-error
                                const arg_data = DeserializeTuple(stream, net_tuple_def);

                                if(predicted_action === undefined){
                                    console.log("Received item ack for unknown action_id: ", action_id, ItemActionLinker.IDToName(action_id));
                                    break;
                                }

                                //@ts-ignore
                                predicted_action.ack_success(...arg_data);
                            } else {
                                if(predicted_action === undefined){
                                    console.log("Received item ack for unknown action_id: ", action_id, ItemActionLinker.IDToName(action_id));
                                    break;
                                }

                                predicted_action.ack_fail(ack_code);
                            }


                            
                            break;
                        }

                        default: AssertUnreachable(type);
                    }

                    _debug_last_packet_type = _debug_current_packet_type;
                }
            }


            if(this.game.player !== null && !this.game.player.authority_over_position && this.ticks_into_round > this.ticks_to_gain_authority){
                this.game.player.authority_over_position = true;
            }

            // Interpolation of entities
            const frameToSimulate = this.getServerTickToSimulate();

            for(const obj of this.remotelocations){
                obj.setPosition(frameToSimulate);
            }

            for(const obj of this.remoteEntities.values()){
                const list = obj.constructor["INTERP_LIST"] as string[]; // List of variables that are interpolated
                for(const key of list){
                    const interpVar = obj["__"+key+"__BUFFER_"] as InterpolatedVarType<any>;
                    const interpValue = interpVar.buffer.getValue(frameToSimulate);
                    obj["__"+key] = interpValue;
                    // console.log(key, obj);
                }
            }
        }
    }

    /** Returns the fractional tick that we think the server is "currently simulating" */
    private calculateCurrentServerTick(): number {
        // The time of the latest packet we "just received", translated to serverTime
        const serverTimeOfPacketJustReceived = (this.currentServerTime() - this.ping);

        // Now we know what 'server time' frame to simulate, need to convert it to a frame number
        const msPassedSinceLastTickReference = serverTimeOfPacketJustReceived - Number(this.REFERENCE_SERVER_TICK_TIME);

        
        // Divide by thousand in there to convert to seconds, which is the unit of SERVER_SEND_RATE 
        const currentServerTick = this.REFERENCE_SERVER_TICK_ID + (((msPassedSinceLastTickReference / 1000) * (this.SERVER_SEND_RATE)));
        
        return currentServerTick;
    }

    /** Includes fractional part of tick */
    private getServerTickToSimulate(): number {
        // In milliseconds
        const serverTime = this.currentServerTime(); //Date.now() + this.CLOCK_DELTA;

        // If ping is inaccurate, this will break. 
        // If this.ping is a lot lower than it really is, interpolation will break. 
        // If too high, just makes interpolation a bit farther in the past. 
        // Maybe add some padding just in case, of a couple ms?

        const serverTimeOfPacketJustReceived = serverTime - this.ping;

        const serverTimeToSimulate = serverTimeOfPacketJustReceived - this.dejitterTime;

        // Now we know what 'server time' frame to simulate, need to convert it to a frame number
        const msPassedSinceLastTickReference = serverTimeToSimulate - Number(this.REFERENCE_SERVER_TICK_TIME);

        
        // Divide by thousand in there to convert to seconds, which is the unit of SERVER_SEND_RATE 
        const theoreticalTickToSimulate = this.REFERENCE_SERVER_TICK_ID + (((msPassedSinceLastTickReference / 1000) * (this.SERVER_SEND_RATE)));
        
        // console.log(currentServerTick);
        
        // Includes fractional part of tick
        //  - 1, because need to interpolate from last frame to current frame. We don't necesarrily even have floor(theoreticalTickToSimulate) + 1 yet, 
        const frameToGet = theoreticalTickToSimulate - 1;
        
        return frameToGet;
    }

    enqueueStagePacket(packet: PacketWriter){
        this.stagePacketsToSerialize.push(packet);
    }

    enqueueGeneralPacket(packet: PacketWriter){
        this.generalPacketsToSerialize.push(packet);
    }
    
    writePackets(){
        if(this.network.CONNECTED && this.SERVER_IS_TICKING){

            const stream = this.sendStream;
            stream.setUint8(ServerPacketSubType.QUEUE);

            // If I'm in the ACTIVE state, my player is still alive
            if(this.currentPlayState === ClientPlayState.ACTIVE){

                const player = this.game.player;

                stream.setUint8(ServerBoundPacket.PLAYER_POSITION);
                stream.setFloat32(player.x);
                stream.setFloat32(player.y);
                stream.setFloat32(this.engine.mouse.x);
                stream.setFloat32(this.engine.mouse.y);
                stream.setUint8(player.animation_state);
                stream.setBool(player.velocity.x < 0);
                stream.setBool(this.engine.mouse.isDown("left"));
                stream.setBool(this.engine.keyboard.wasPressed("KeyF"));
                stream.setBool(this.engine.keyboard.wasPressed("KeyQ"));       
            }

            for(const packet of this.generalPacketsToSerialize){
                packet.write(stream);
            }
            this.generalPacketsToSerialize = [];

            
            for(const packet of this.stagePacketsToSerialize){
                packet.write(stream);
            }
            this.stagePacketsToSerialize = [];


            // Only send if we actually write something to the stream
            if(stream.size() > 1){
                this.network.send(stream.cutoff());
            }

                // Allow it to be re-used
            stream.refresh()
        }
    }

    update(delta: number): void {}

    @remotefunction("test1")
    thisMethodNameDoesNotMatter(name: number, food: number){
        console.log(`REMOTE FUNCTION CALLED -> Name is ${name}, food is ${food}`);
    }


    @remotefunction("testVecFunction")
    asgdfygafsdjyafsdyasd(value: Vec2){
        console.log(value.toString());
    }
}

const long_match_win_strings = [
    "Finally, a winner!",
    "_ fought long and hard!",
    "Bravo _!",
];

const simple_win_strings = [
    "Well done _!",
    "_ takes the W",
    "_ is truly the best",
    "_ wins this one",
];

const repeated_win_strings = [
    "_ wins another one!",
    "_ must be stopped!",
    "_ does it again",
];

/** Remote Function Logic */
type RemoteFunctionListType = {
    remoteFunctionName: keyof RemoteFunction,
    methodName: keyof NetworkSystem,
}[]

// Event registering with decorators
function remotefunction<T extends keyof RemoteFunction>(functionName: T) {


    return function(target: NetworkSystem, propertyKey: keyof NetworkSystem, descriptor: TypedPropertyDescriptor<NetCallbackTypeV1<RemoteFunction[T]>>){
        // target is the prototype of the class

        const constructorClass = target.constructor;
        
        if(constructorClass["REMOTE_FUNCTION_REGISTRY"] === undefined){
            constructorClass["REMOTE_FUNCTION_REGISTRY"] = [];
        }

        const remotefunctionlist = constructorClass["REMOTE_FUNCTION_REGISTRY"] as RemoteFunctionListType;
        remotefunctionlist.push({
            remoteFunctionName: functionName,
            methodName: propertyKey,
        });

        // console.log(`Added remote function callback, ${functionName}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
    }
}



