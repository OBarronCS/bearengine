import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { Scene, StreamReadEntityID } from "shared/core/scene";
import { PacketWriter, RemoteFunction, RemoteFunctionLinker } from "shared/core/sharedlogic/networkedentitydefinitions";
import { GamePacket, ServerBoundPacket, ServerImmediatePacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { TerrainManager } from "shared/core/terrainmanager";
import { SharedEntityClientTable } from "./cliententitydecorators";
import { RemoteEntity, RemoteLocations, SimpleNetworkedSprite } from "./remotecontrol";
import { BufferedNetwork } from "./clientsocket";
import { Entity } from "../entity";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream";
import { Player } from "../../gamelogic/player";
import { abs, ceil } from "shared/mathutils";



/** Reads packets from network, sends them */
export class NetworkSystem extends Subsystem {

    private network: BufferedNetwork;

    private scene: Scene;
    public remotelocations = this.addQuery(RemoteLocations);

    // contains networked entities
    private entities: Map<number, RemoteEntity> = new Map(); 

    private packetsToSerialize: PacketWriter[] = [];

    private remoteFunctionCallMap = new Map<keyof RemoteFunction,keyof NetworkSystem>()


    public PLAYER_ID = -1;

    public SERVER_IS_TICKING: boolean = false;
    private SERVER_SEND_RATE: number = -1;

    // These are used to calculate the current tick the server is sending, received in INIT packet
    private REFERENCE_SERVER_TICK_ID: number = 0;
    private REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds, adjusted on ping packets */
    private CLOCK_DELTA = 0;

    // Generous, default ping
    // MAYBE: set it to -1 and don't start ticking until we actually know it. Right now it starts ticking and then some time later the ping is adjusted
    private ping: number = 100;

    /** MILLISECONDS,
     * Used to adjust the currentTick we should simulate, used for interpolation. In effect, hold onto info for this long before simulating them 
     * In practice, it combats jitter in packet receiving times (even though server sends at perfect interval, we don't receive them in that same perfect interval)
     * Experiment with making this lower, maybe even 50
    */
    private dejitterTime = 100;
    
    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
        network.pongcallback = this.calculatePong.bind(this);
    }

    private getEntity<T extends AbstractEntity = AbstractEntity>(id: number): T {
        return this.entities.get(id) as any as T;
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
        this.scene = this.getSystem(Scene);

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
        this.entities.set(entityID, e);
        this.scene.addEntity(e);

        return e;
    }

    calculatePong(stream: BufferStreamReader){
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
        if(this.ping < 0) console.log("Ping is negative") 
        if(this.ping <= 0) this.ping = 1;


        // This method assumes latency is equal both ways
        const delta = serverStamp - currentTime + BigInt(this.ping);

        // LOCAL TIME + CLOCK_DELTA === TIME_ON_SERVER
        this.CLOCK_DELTA = Number(delta);
    }

    private timeOfLastPing = Date.now(); 

    /**  Read from network, apply packets */
    readPackets(){
        if(this.network.CONNECTED){

            // send ping packet every 2 seconds
            const now = Date.now();
            if(now >= this.timeOfLastPing + 2000){
                this.sendPing();
                this.timeOfLastPing = now;
            }

            const packets = this.network.getNewPacketQueue();

            while(!packets.isEmpty()){

                const packet = packets.dequeue();
                const frame = packet.id;
                const stream = packet.buffer;

                while(stream.hasMoreData()){
                    const type: GamePacket = stream.getUint8();

                    switch(type){
                        case GamePacket.INIT: {
                            // [ tick_rate: uint8, reference time: biguint64, tick: uint16, uint8: your_player_id] 
                            const rate = stream.getUint8();
                            this.SERVER_SEND_RATE = rate;

                            // These may desync over time. Maybe resend them every now and then if it becomes an issue?
                            this.REFERENCE_SERVER_TICK_TIME = stream.getBigUint64();
                            this.REFERENCE_SERVER_TICK_ID = stream.getUint16();
                            this.PLAYER_ID = stream.getUint8();

                            console.log("My player id is: " + this.PLAYER_ID);
                            break;
                        }
                        case GamePacket.START_TICKING: {
                            this.SERVER_IS_TICKING = true;
                            const tick = stream.getUint16(); // Reads this number so stream isn't broken
                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_CREATE: {

                            const sharedClassID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);
                            
                            this.createAutoRemoteEntity(sharedClassID,entityID);
                           

                            break;
                        }
                        case GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE:{

                            const SHARED_ID = stream.getUint8();
                            const entityID = StreamReadEntityID(stream);

                            let entity = this.entities.get(entityID);

                            if(entity === undefined){
                                // Will try to create the entity for now, but we missed the REMOTE_ENTITY_CREATE packet clearly
                                console.log(`Cannot find entity ${entityID}, will create`);
                                entity = this.createAutoRemoteEntity(SHARED_ID,entityID)
                                return;
                            }

                            SharedEntityClientTable.deserialize(stream, SHARED_ID, entity);

                            break;
                        }       
                        case GamePacket.REMOTE_FUNCTION_CALL:{
                            const functionID = stream.getUint8();
                            const functionName = RemoteFunctionLinker.getStringFromID(functionID)

                            const methodOfThisObject = this.remoteFunctionCallMap.get(functionName);

                            RemoteFunctionLinker.callRemoteFunction(functionName, stream, this, methodOfThisObject);
                            
                            break;
                        }
                        case GamePacket.ENTITY_DESTROY:{
                             // Find correct entity
                            const id = StreamReadEntityID(stream);

                            let e = this.entities.get(id);
                            if(e !== undefined){
                                console.log("Destroying entity: " + id);

                                this.scene.destroyEntity(e);
                            }
                            break;
                        }
                        case GamePacket.PLAYER_POSITION:{
                            
                            // Find correct entity
                            const id = StreamReadEntityID(stream);;
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
                            const id = StreamReadEntityID(stream);
                            
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
                        case GamePacket.PASSTHROUGH_TERRAIN_CARVE_CIRCLE: {
                            const terrain = this.getSystem(TerrainManager);
                            const pId = stream.getUint8();
                            const x = stream.getFloat64();
                            const y = stream.getFloat64();
                            const r = stream.getInt32();
                            
                            if(pId !== this.PLAYER_ID)
                                terrain.carveCircle(x, y, r);
                            
                            break;
                        }
                        default: AssertUnreachable(type);
                    }
                }
                
            }

            // Interpolation of entities
            const frameToSimulate = this.getServerTickToSimulate();

            for(const obj of this.remotelocations){
                obj.setPosition(frameToSimulate)
            }
        }
    }


    /** Includes fractional part of tick */
    private getServerTickToSimulate(): number {
        // In milliseconds
        const serverTime = Date.now() + this.CLOCK_DELTA;

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
        if(this.network.CONNECTED && this.SERVER_IS_TICKING){
            const player = this.getSystem(Scene).getEntityByTag<Player>("Player");
            const stream = new BufferStreamWriter(new ArrayBuffer(256));

            stream.setUint8(ServerPacketSubType.QUEUE);
            stream.setUint8(ServerBoundPacket.PLAYER_POSITION);
            stream.setFloat32(player.x);
            stream.setFloat32(player.y);


            for(const packet of this.packetsToSerialize){
                packet.write(stream);
            }

            this.packetsToSerialize = []

            this.network.send(stream.cutoff());
        }
    }

    update(delta: number): void {}

    @remotefunction("test1")
    thisMethodNameDoesNotMatter(name: number, food: number){
        console.log(`REMOTE FUNCTION CALLED -> Name is ${name}, food is ${food}`);
    }


    @remotefunction("testFunction")
    asgdfygafsdjyafsdyasd(value: number){
        console.log(value);
    }
}


/** Remote Function Logic */
type RemoteFunctionListType = {
    remoteFunctionName: keyof RemoteFunction,
    methodName: keyof NetworkSystem,
}[]

// Event registering with decorators
function remotefunction<T extends keyof RemoteFunction>(functionName: T) {


    return function(target: NetworkSystem, propertyKey: keyof NetworkSystem, descriptor: TypedPropertyDescriptor<RemoteFunction[T]["callback"]>){
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

        console.log(`Added remote function callback, ${functionName}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
    }
}



