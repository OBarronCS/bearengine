import { AbstractEntity} from "shared/core/abstractentity"
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Vec2 } from "shared/shapes/vec2";
import { GameStatePacket } from "shared/core/sharedlogic/packetdefinitions"

export abstract class ServerEntity extends AbstractEntity {}

// One instance of this corresponds to one RemoteEntity client side
export abstract class NetworkedEntity extends ServerEntity {
    static NEXT_ID = 0;

    abstract packetType: GameStatePacket;

    protected readonly id = NetworkedEntity.NEXT_ID++;

    constructor(){
        super();
    }

    writeEntityData(stream: BufferStreamWriter){
        stream.setUint8(this.packetType);
        stream.setUint16(this.id);
        this.write(stream);
    }

    protected abstract write(stream: BufferStreamWriter): void;
}


export class FirstNetworkedEntity extends NetworkedEntity {
    packetType: GameStatePacket = GameStatePacket.SIMPLE_POSITION;

    constructor(){
        super();
    }

    update(dt: number): void {
        this.position.add(Vec2.random().extend(200));
    }

    write(stream: BufferStreamWriter){
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }
}


export class RemotePlayer extends NetworkedEntity {
    packetType: GameStatePacket = GameStatePacket.SIMPLE_POSITION;

    protected write(stream: BufferStreamWriter): void {
        stream.setFloat32(this.x);
        stream.setFloat32(this.y);
    }

    update(dt: number): void {}
}




