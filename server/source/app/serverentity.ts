import { AbstractEntity} from "shared/core/abstractentity"
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Vec2 } from "shared/shapes/vec2";
import { ClientBoundPacket } from "shared/core/sharedlogic/packetdefinitions"

export abstract class ServerEntity extends AbstractEntity {}

// One instance of this corresponds to one RemoteEntity client side
export abstract class NetworkedEntity extends ServerEntity {
    static NEXT_ID = 0;

    abstract packetType: ClientBoundPacket;

    protected id = NetworkedEntity.NEXT_ID++;

    constructor(){
        super();
    }

    writeEntityData(stream: BufferStreamWriter){
        stream.setUint16(this.packetType);
        stream.setUint16(this.id);
        this.write(stream);
    }

    protected abstract write(stream: BufferStreamWriter): void;
}



export class FirstNetworkedEntity extends NetworkedEntity {
    packetType: ClientBoundPacket = ClientBoundPacket.SIMPLE_POSITION;

    private move: Vec2

    constructor(move: Vec2){
        super();
        this.move = move;

    }

    update(dt: number): void {
        this.position.add(this.move)
    }

    write(stream: BufferStreamWriter){
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}






