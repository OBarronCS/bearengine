


import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { LevelHandler } from "shared/core/level";
import { Vec2 } from "shared/shapes/vec2";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { chance } from "shared/randomhelpers";
import { AbstractEntity } from "shared/core/abstractentity";
import { ClientPacket, GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { AssertUnreachable } from "shared/assertstatements";
import { LinkedQueue } from "shared/datastructures/queue";

import { FirstNetworkedEntity, NetworkedEntity, ServerEntity } from "./serverentity";
import { ClientConnection, ServerNetwork } from "./networking/serversocket";

export class RemotePlayer {
    readonly id: number = -1;
    readonly position: Vec2 = new Vec2(0,0);
}


class ServerBearEngine {

    public network: ServerNetwork = null;
    public readonly TICK_RATE: number;

    private NEXT_ENTITY_ID = 0;

    public totalTime = 0;

    private updateList: AbstractEntity[] = [];
    private networkedEntities: NetworkedEntity[] = [];
    private previousTick: number = 0;

    
    // Just turn this into a stream that is written to.
    private networkMessageQueue = new LinkedQueue<{id: number}>();


    private players = new Map<ClientConnection,RemotePlayer>();

    constructor(tick_rate: number){
        this.TICK_RATE = tick_rate;
    }
    
    start(port: number){
        this.network = new ServerNetwork(this.TICK_RATE,port, this)
        this.network.start();
        this.previousTick = Date.now();

        this.loop();
    }

	// startLevel(level_struct: CustomMapFormat){
	// 	this.current_level = new LevelHandler(level_struct);
    //     this.current_level.load();

    //     //@ts-expect-error
    //     AbstractEntity.GLOBAL_DATA_STRUCT = {
    //         Scene: this,
    //         Level: this.current_level,
    //         Collision: this.current_level.collisionManager,           
    //         Terrain: this.current_level.terrainManager
    //     }
    // }

    private _boundLoop = this.loop.bind(this);

    // Reads from queue of data since last tick
    private readNetwork(){
        const packets = this.network.packetQueue();

        while(!packets.isEmpty()){
            const packet = packets.dequeue();
            
            const client = packet.client;
            const stream = packet.buffer;

            const type: ClientPacket = stream.getUint8();

            switch(type){
                case ClientPacket.JOIN_GAME: {
                    // Maybe: first check that it hasn't been created. Don't want join packet being sent twice on accident
                    const player = new RemotePlayer();
                    //@ts-expect-error
                    player.id = this.NEXT_ENTITY_ID++;
                    this.players.set(client, player);
                    break;
                }
                case ClientPacket.LEAVE_GAME: {
                    const player = this.players.get(client);
                    this.players.delete(client);
                    this.networkMessageQueue.enqueue({id: player.id })
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


    writeToNetwork(now: number){
        // Write all PacketData to a buffer
        const stream = new BufferStreamWriter(new ArrayBuffer(256));

        this.network.writePacketStateData(stream);

        while(!this.networkMessageQueue.isEmpty()){
            stream.setUint8(GamePacket.ENTITY_DESTROY);
            stream.setUint16(this.networkMessageQueue.dequeue().id);
        }

        for (let i = 0; i < this.networkedEntities.length; i++) {
            const entity = this.networkedEntities[i];
            entity.writeEntityData(stream);
        }

        for(const player of this.players.values()){
            //console.log(player)
            stream.setUint8(GamePacket.PLAYER_POSITION);
            stream.setUint16(player.id);
            stream.setFloat32(player.position.x);
            stream.setFloat32(player.position.y);
        }
    

        this.network.sendGameData(stream.cutoff(), now);

        console.log(this.network.tick,Date.now()  - this.previousTick);
    }

    loop(){
        const now = Date.now();

        // If we have made it far enough to TICK THE GAME
        if (this.previousTick + (1000 / this.TICK_RATE) <= now) {
            const dt = this.TICK_RATE;
             // this.current_level.collisionManager.update(dt);

            // if(chance(15)){ 
            //     console.log("NEW")
            //     this.addNetworkedEntity(new FirstNetworkedEntity());    
            // }
            
            this.readNetwork();
            
            for (let i = 0; i < this.updateList.length; i++) {
                const entity = this.updateList[i];
                entity.update(dt);
                entity.postUpdate();
            }
        
            this.writeToNetwork(now)

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
   
    addEntity<T extends AbstractEntity>(e: T): T {
        this.updateList.push(e);
        return e;
    }

    destroyEntity<T extends AbstractEntity>(e: T): void {
        const index = this.updateList.indexOf(e);
        if(index !== -1){
            this.updateList.splice(index,1);
        }
    }

    addNetworkedEntity(e: NetworkedEntity){
        // @ts-expect-error
        e.id = this.NEXT_ENTITY_ID++;
        this.addEntity(e);
        this.networkedEntities.push(e);
    }
}


export {
    ServerBearEngine,
}


