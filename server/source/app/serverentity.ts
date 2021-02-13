import { AbstractEntity} from "shared/core/abstractentity"
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Vec2 } from "shared/shapes/vec2";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions"

export abstract class ServerEntity extends AbstractEntity {}

// One instance of this corresponds to one RemoteEntity client side
export abstract class NetworkedEntity extends ServerEntity {

    readonly id = -1;

    abstract packetType: GamePacket;

    writeEntityData(stream: BufferStreamWriter){
        if(this.id === -1) throw new Error("THIS SHOULDN'T BE HAPPENING")

        stream.setUint8(this.packetType);
        stream.setUint16(this.id);
        this.write(stream);
    }

    protected abstract write(stream: BufferStreamWriter): void;
}


export class FirstNetworkedEntity extends NetworkedEntity {
    packetType: GamePacket = GamePacket.SIMPLE_POSITION;

    update(dt: number): void {
        this.position.add(Vec2.random().extend(200));
    }

    write(stream: BufferStreamWriter){
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}




