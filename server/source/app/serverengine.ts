


import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { FirstNetworkedEntity, NetworkedEntity, ServerEntity } from "./serverentity";

import { LevelHandler } from "shared/core/level";
import { ServerNetwork } from "./networking/serversocket";
import { Vec2 } from "shared/shapes/vec2";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { chance } from "shared/randomhelpers";
import { AbstractEntity } from "shared/core/abstractentity";


class ServerBearEngine {
    // Total simulated time, in seconds
    public totalTime = 0;

    public network: ServerNetwork = null;


    public TICK_RATE: number;

    // Things that should be globally accessible by SE
    private current_level: LevelHandler = null;

    private updateList: AbstractEntity[] = [];
    private networkedEntities: NetworkedEntity[] = [];
    private previousTick: number = 0;

    constructor(tick_rate: number){
        this.TICK_RATE = tick_rate;
    }
    
    start(port: number){
        this.network = new ServerNetwork(this.TICK_RATE,port, this)
        this.network.start();
        this.previousTick = Date.now();

        this.loop();
    }

	startLevel(level_struct: CustomMapFormat){
		this.current_level = new LevelHandler(level_struct);
        this.current_level.load();

        //@ts-expect-error
        AbstractEntity.GLOBAL_DATA_STRUCT = {
            Scene: this,
            Level: this.current_level,
            Collision: this.current_level.collisionManager,           
            Terrain: this.current_level.terrainManager
        }
    }

    private _boundLoop = this.loop.bind(this);

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
            
            
            for (let i = 0; i < this.updateList.length; i++) {
                const entity = this.updateList[i];
                entity.update(dt);
                entity.postUpdate();
            }
        
            // Write all PacketData to a buffer
            const stream = new BufferStreamWriter(new ArrayBuffer(256));
            this.network.writePacketStateData(stream);

            for (let i = 0; i < this.networkedEntities.length; i++) {
                const entity = this.networkedEntities[i];
                entity.writeEntityData(stream);
            }
        

            this.network.sendGameData(stream.cutoff(), now);


            console.log(this.network.tick,Date.now()  - this.previousTick);

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
        this.addEntity(e);
        this.networkedEntities.push(e);
    }
    
    restartCurrentLevel(){
        const data = this.current_level.data_struct;
        this.endCurrentLevel();
        this.startLevel(data);
    }

    endCurrentLevel(){
        this.current_level.end();

        for(let i = this.updateList.length - 1; i >= 0; --i){
            this.destroyEntity(this.updateList[i]);
        }
    }   
}


export {
    ServerBearEngine,
}


