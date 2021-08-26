import { AssertUnreachable } from "shared/misc/assertstatements";
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { EntitySystem, StreamReadEntityID } from "shared/core/entitysystem";
import { NetCallbackTypeV1, PacketWriter, RemoteFunction, RemoteFunctionLinker, RemoteResourceLinker } from "shared/core/sharedlogic/networkschemas";
import { ClientBoundImmediate, ClientBoundSubType, GamePacket, ServerBoundPacket, ServerImmediatePacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { SharedEntityClientTable } from "./cliententitydecorators";
import { RemoteLocations } from "./remotecontrol";
import { CallbackNetwork, NetworkSettings } from "./clientsocket";
import { Entity } from "../entity";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { Player, RemotePlayer } from "../../gamelogic/player";
import { abs, ceil } from "shared/misc/mathutils";
import { LinkedQueue } from "shared/datastructures/queue";
import { BearEngine, NetworkPlatformGame } from "../bearengine";
import { NETWORK_VERSION_HASH } from "shared/core/sharedlogic/versionhash";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { DummyLevel } from "../gamelevel";
import { Vec2 } from "shared/shapes/vec2";
 
import { Gamemode } from "shared/core/sharedlogic/sharedenums"
import { SparseSet } from "shared/datastructures/sparseset";
import { Deque } from "shared/datastructures/deque";
import { CreateItemData, ItemType, ITEM_LINKER } from "shared/core/sharedlogic/items";
import { CreateClientItemFromType, ShootHitscanWeapon, ShootModularWeapon, TerrainCarverAddons } from "../clientitems";
import { Line } from "shared/shapes/line";

class ClientInfo {
    uniqueID: number;
    ping: number;
    name: string;
    gamemode: Gamemode;

    constructor(uniqueID: number, ping: number, name: string, gamemode: Gamemode){
        this.uniqueID = uniqueID;
        this.ping = ping;
        this.name = name;
        this.gamemode = gamemode;
    }

    toString(): string {
        return `Client ${this.uniqueID}: [ping: ${this.ping}, gamemode: ${this.gamemode}]`;
    }
}

interface BufferedPacket {
    buffer: BufferStreamReader;
    id: number;
}


export class NetworkSystem extends Subsystem<NetworkPlatformGame> {


    private incShotID = 0;

    getLocalShotID(){
        return this.incShotID++;
    }

    private network: CallbackNetwork;
    /** Packets from the server are queued here */
    private packets = new LinkedQueue<BufferedPacket>();
    private sendStream = new BufferStreamWriter(new ArrayBuffer(256));


    private scene: EntitySystem;
    public remotelocations = this.addQuery(RemoteLocations);

    

    /** Set of all other clients */
    private otherClients = new SparseSet<ClientInfo>(256);


    private remoteEntities: Map<number, Entity> = new Map();
    private remotePlayers: Map<number, RemotePlayer> = new Map(); 



    private packetsToSerialize: PacketWriter[] = [];

    private remoteFunctionCallMap = new Map<keyof RemoteFunction,keyof NetworkSystem>()



    public SERVER_ROUND_ACTIVE = false;


    // MY PLAYER ID
    public PLAYER_ID = -1;


    public SERVER_IS_TICKING: boolean = false;
    private SERVER_SEND_RATE: number = -1;

    // These are used to calculate the current tick the server is sending, received in INIT packet
    private REFERENCE_SERVER_TICK_ID: number = 0;
    private REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds, adjusted on ping packets */
    private CLOCK_DELTA = 0;

    private _serverTime = 0;
    currentServerTime(): number { return this._serverTime; }
    
    private _serverTick = 0;
    currentServerTick(): number { return this._serverTick; }

    // Generous, default ping
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
    private byteAmountReceived: Deque<{bytes:number, time: number}> = new Deque();
    bytesPerSecond = 0;
    
    

    

    constructor(engine: NetworkPlatformGame, settings: NetworkSettings){
        super(engine);
        this.network = new CallbackNetwork(settings, this.onmessage.bind(this));
    }

    public connect(){
        this.network.connect();
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
        this.scene = this.game.entities;

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
        
    }

    // This entityID is from the network, and doesn't contain the version number
    private createAutoRemoteEntity(sharedID: number, entityID: EntityID): Entity {
        const _class = SharedEntityClientTable.getEntityClass(sharedID);

        //@ts-expect-error
        const e = new _class();

        // Adds it to the scene
        this.remoteEntities.set(entityID, e);
        this.scene.addEntity(e);

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

    /**  Read from network, apply packets */
    readPackets(): void {
        if(this.network.CONNECTED){

            // send ping packet every 2 seconds

            const now = Date.now();


            this._serverTime = now + this.CLOCK_DELTA;
            this._serverTick = this.calculateCurrentServerTick();


            if(now >= this.timeOfLastPing + 2000){
                this.sendPing();
                this.timeOfLastPing = now;
            }


            // Calculation bytes per second
            while(!this.byteAmountReceived.isEmpty() && this.byteAmountReceived.peekLeft().time < now - 1025){
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
                    this.bytesPerSecond = sum;;// / (dt / 1000);
                }
            } else {
                this.bytesPerSecond = 0;
            }


            
            const packets = this.packets;

            while(!packets.isEmpty()){

                const packet = packets.dequeue();
                const frame = packet.id;
                const stream = packet.buffer;

                while(stream.hasMoreData()){
                    const type: GamePacket = stream.getUint8();

                    // console.log(GamePacket[type])

                    switch(type){
                        case GamePacket.INIT: {
                            
                            const hash = stream.getBigUint64();
                            if(hash !== NETWORK_VERSION_HASH){
                                throw new Error("Network protocol out of date");
                            }

                            const rate = stream.getUint8();
                            this.SERVER_SEND_RATE = rate;

                            // These may desync over time. Maybe resend them every now and then if it becomes an issue?
                            this.REFERENCE_SERVER_TICK_TIME = stream.getBigUint64();
                            this.REFERENCE_SERVER_TICK_ID = stream.getUint16();
                            this.PLAYER_ID = stream.getUint8();

                            console.log("My player id is: " + this.PLAYER_ID);
                            break;
                        }
                        case GamePacket.SERVER_IS_TICKING: {
                            this.SERVER_IS_TICKING = true;
                            const tick = stream.getUint16(); // Reads this number so stream isn't broken
                            break;
                        }

                        // OTHER PLAYER INFO
                        case GamePacket.OTHER_PLAYER_INFO_ADD: {
                            const uniqueID = stream.getUint8();
                            const ping = stream.getUint16();
                            const gamemode = stream.getUint8();

                            

                            // Don't add self
                            if(this.PLAYER_ID !== uniqueID){
                                const newClient = new ClientInfo(uniqueID,ping,"",gamemode);

                                console.log("Create client: " + newClient.toString());

                                this.otherClients.set(uniqueID, newClient);
                            }

                            break;
                        }
                        case GamePacket.OTHER_PLAYER_INFO_REMOVE: {
                            const uniqueID = stream.getUint8();

                            const i = this.otherClients.get(uniqueID);
                            console.log("Removing player: " + i);

                            this.otherClients.remove(uniqueID);

                            

                            break;
                        }
                        case GamePacket.OTHER_PLAYER_INFO_GAMEMODE: {
                            const uniqueID = stream.getUint8();
                            const gamemode: Gamemode = stream.getUint8();

                            const client = this.otherClients.get(uniqueID);

                            if(client === null) { 
                                console.log("GAMEMODE FOR UNKNOWN PLAYER");
                                continue;
                            }

                            client.gamemode = gamemode;

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

                            console.log("CREATE: ", sharedClassID, " ", entityID);

                            const check = this.remoteEntities.get(entityID);
                            if(check !== undefined) throw new Error("Entity already exists");

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
                                entity = this.createAutoRemoteEntity(SHARED_ID,entityID)
                            }

                            //console.log("CHANGING VAR: " + entityID + " at frame " + frame);

                            SharedEntityClientTable.deserialize(stream, frame, SHARED_ID, entity);

                            break;
                        }       

                        case GamePacket.REMOTE_ENTITY_EVENT: {
                            
                            const SHARED_ID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);
                            const eventID = stream.getUint8();

                            let entity = this.remoteEntities.get(entityID);

                            if(entity === undefined){
                                // Will try to create the entity for now, but we missed the REMOTE_ENTITY_CREATE packet clearly
                                SharedEntityClientTable.readThroughRemoteEventStream(stream, SHARED_ID, eventID, entity)
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

                            const entity = this.remoteEntities.get(entityID);

                            if(entity !== undefined){
                                this.remoteEntities.delete(entityID);
                                this.scene.destroyEntity(entity);
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
                        case GamePacket.START_ROUND: {
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();
                            const level = RemoteResourceLinker.getResourceFromID(stream.getUint8());

                            this.game.endCurrentLevel();
                            this.game.loadLevel(new DummyLevel(level));

                            const p = (this.game.player = new Player());
                            this.scene.addEntity(p);

                            p.x = x;
                            p.y = y;

                            this.SERVER_ROUND_ACTIVE = true;
                            console.log("Round begun")
                            break;
                        }
                        case GamePacket.END_ROUND: {
                            console.log("Round ended")

                            for(const e of this.remotePlayers.values()){
                                e.destroy();
                            }

                            for(const e of this.remoteEntities.values()){
                                e.destroy();
                            }

                            this.remotePlayers.clear();
                            this.remoteEntities.clear();

                            // this.engine.player = null;

                            this.SERVER_ROUND_ACTIVE = false;

                            break;
                        }
                        case GamePacket.PLAYER_CREATE : {
                            // [playerID: uint8, x: float32, y: float32]

                            const pID = stream.getUint8();
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            if(pID === this.PLAYER_ID){
                                console.log("Don't create self")
                                continue;
                            }
                            let checkIfExists = this.remotePlayers.get(pID);
                            if(checkIfExists !== undefined){
                                console.log("Trying to create player entity that already exists")
                                continue;
                            }

                            console.log("Creating other player, id: " + pID)

                            const entity = new RemotePlayer(pID);
                            this.remotePlayers.set(pID, entity);
                            this.scene.addEntity(entity);
                            
                            break;
                        }
                        case GamePacket.PLAYER_DESTROY:{
                            // Find correct entity
                           const pId = stream.getUint8();

                           if(pId === this.PLAYER_ID){
                               // Destroy my own
                               this.game.player.dead = true;

                               continue;
                           }

                           let e = this.remotePlayers.get(pId);
                           if(e !== undefined){
                               console.log("Destroying player: " + pId);

                               this.remotePlayers.delete(pId);
                               this.scene.destroyEntity(e);
                           }
                           break;
                        }
                        case GamePacket.PLAYER_POSITION:{
                           


                            // Find correct entity
                            const playerID = stream.getUint8();
                    
                            const x = stream.getFloat32();
                            const y = stream.getFloat32();
                            const state = stream.getUint8();
                            const flipped = stream.getBool();
                            const health = stream.getUint8();

                            if(playerID === this.PLAYER_ID){
                                this.game.player.health = health;
                                continue;
                            }


                            let e = this.remotePlayers.get(playerID);
                            if(e === undefined){
                                console.log("Unknown player data");
                                continue;
                            }

                            // console.log(`Player data for ${playerID}, at tick ${frame}`)

                            e.locations.addPosition(frame, x,y);
                            e.setState(state,flipped);
                            e.health = health;
                            
                            break;
                        }
                        case GamePacket.TERRAIN_CARVE_CIRCLE: {
                            const terrain = this.game.terrain;
                            const x = stream.getFloat64();
                            const y = stream.getFloat64();
                            const r = stream.getInt32();
                            
                            terrain.carveCircle(x, y, r);

                            this.engine.renderer.addEmitter("assets/flower.png", {
                                alpha: {
                                    list: [
                                        {
                                            value: 0.8,
                                            time: 0
                                        },
                                        {
                                            value: 0.1,
                                            time: 1
                                        }
                                    ],
                                    isStepped: false
                                },
                                scale: {
                                    list: [
                                        {
                                            value: 1,
                                            time: 0
                                        },
                                        {
                                            value: 0.3,
                                            time: 1
                                        }
                                    ],
                                    isStepped: false
                                },
                                color: {
                                    list: [
                                        {
                                            value: "fb1010",
                                            time: 0
                                        },
                                        {
                                            value: "f5b830",
                                            time: 1
                                        }
                                    ],
                                    isStepped: false
                                },
                                speed: {
                                    list: [
                                        {
                                            value: 200,
                                            time: 0
                                        },
                                        {
                                            value: 100,
                                            time: 1
                                        }
                                    ],
                                    isStepped: false
                                },
                                startRotation: {
                                    min: 0,
                                    max: 360
                                },
                                rotationSpeed: {
                                    min: 0,
                                    max: 0
                                },
                                lifetime: {
                                    min: 0.5,
                                    max: 0.5
                                },
                                frequency: 0.008,
                                spawnChance: 1,
                                particlesPerWave: 1,
                                emitterLifetime: 0.31,
                                maxParticles: 1000,
                                pos: {
                                    x: 0,
                                    y: 0
                                },
                                addAtBack: false,
                                spawnType: "circle",
                                spawnCircle: {
                                    x: 0,
                                    y: 0,
                                    r: 10
                                }
                            }, x, y);
                            
                            break;
                        }

                        case GamePacket.SET_INV_ITEM: {
                            const item_id = stream.getUint8();

                            const item_data = CreateItemData(ITEM_LINKER.IDToName(item_id));

                            const item = CreateClientItemFromType(item_data);

                            
                            this.game.player.setItem(item);
                            break;
                        }

                        case GamePacket.CLEAR_INV_ITEM: {
                            
                            this.game.player.clearItem();

                            break;
                        }

                        case GamePacket.SHOOT_WEAPON: {

                            const creatorID = stream.getUint8();
                            const item_type: ItemType = stream.getUint8();

                            const serverShotID = stream.getUint32();

                            const createServerTick = stream.getFloat32();
                            const pos = new Vec2(stream.getFloat32(), stream.getFloat32());

                            switch(item_type){
                                // fallthrough all non-weapons
                                case ItemType.SIMPLE:{
                                    console.log("How did this happen?")
                                    break;
                                }
                                case ItemType.TERRAIN_CARVER:{
                                    const velocity = new Vec2(stream.getFloat32(), stream.getFloat32());

                                    if(this.PLAYER_ID !== creatorID)
                                        ShootModularWeapon(this.game, TerrainCarverAddons, pos, velocity);
                                    break;
                                }
                                case ItemType.HITSCAN_WEAPON:{
                                    const end = new Vec2(stream.getFloat32(), stream.getFloat32());
                                    const ray = new Line(pos, end);
                                    if(this.PLAYER_ID !== creatorID)
                                        ShootHitscanWeapon(this.game, ray);
                                    break;
                                }
                                default: AssertUnreachable(item_type);

                            }


                            break;
                        }
                        case GamePacket.ACKNOWLEDGE_SHOT: {
                            const success = stream.getBool();

                            const localShotID = stream.getUint32();
                            const serverShotID = stream.getUint32();


                            break;
                        }

                        default: AssertUnreachable(type);
                    }
                }
                
            }


            // Interpolation of entities
            const frameToSimulate = this.getServerTickToSimulate();

            // console.log(frameToSimulate);

            for(const obj of this.remotelocations){
                obj.setPosition(frameToSimulate)
            }

            for(const obj of this.remoteEntities.values()){
                const list = obj.constructor["INTERP_LIST"];
                for(const value of list){
                    const interpVar = obj[value];
                    const interpValue = interpVar.buffer.getValue(frameToSimulate);
                    interpVar.value = interpValue;
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

    queuePacket(packet: PacketWriter){
        this.packetsToSerialize.push(packet);
    }
    
    writePackets(){
        if(this.network.CONNECTED && this.SERVER_IS_TICKING && this.SERVER_ROUND_ACTIVE){
            const player = this.game.player;


            const stream = this.sendStream;
            stream.setUint8(ServerPacketSubType.QUEUE);

            if(!player.dead){    
                stream.setUint8(ServerBoundPacket.PLAYER_POSITION);
                stream.setFloat32(player.x);
                stream.setFloat32(player.y);
                stream.setFloat32(this.engine.mouse.x);
                stream.setFloat32(this.engine.mouse.y);
                stream.setUint8(player.state);
                stream.setBool(player.xspd < 0);
                stream.setBool(this.engine.mouse.isDown("left"));
                stream.setBool(this.engine.keyboard.wasPressed("KeyF"));
                stream.setBool(this.engine.keyboard.wasPressed("KeyQ"));
            }

            for(const packet of this.packetsToSerialize){
                packet.write(stream);
            }

            this.packetsToSerialize = []

            this.network.send(stream.cutoff());

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



