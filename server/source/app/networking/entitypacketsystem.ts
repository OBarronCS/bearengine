
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { NetworkedEntity } from "../serverentity";

// NOT IN USE RIGHT NOW

// At the end of every game tick, this goes through and
export class EntityPacketSystem {

    entities: NetworkedEntity[] = [];

    registerNetworkedEntity<T extends NetworkedEntity>(e: T){
        this.entities.push(e);
    }


    writeGameData(stream: BufferStreamWriter){


    }
}

























