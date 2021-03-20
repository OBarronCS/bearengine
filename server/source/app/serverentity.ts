import { AbstractEntity} from "shared/core/abstractentity"
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { Vec2 } from "shared/shapes/vec2";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions"
import { networkedclass_server, networkedvariable } from "./networking/serverentitydecorators";
import { TickTimer } from "shared/ticktimer";

export abstract class ServerEntity extends AbstractEntity {

    // This shouldn't be touched on entities that are not networked
    // Maybe in future make two seperate lists of entities, on for networked ones and one for not
    stateHasBeenChanged = false;

    stateChanged(): void {
        this.stateHasBeenChanged = true;
    }
}

export class PlayerEntity extends ServerEntity {
    update(dt: number): void {}
}



@networkedclass_server("auto")
export class FirstAutoEntity extends ServerEntity {
    
    private tick = new TickTimer(10,true);

    @networkedvariable("int32")
    public health = 1;

    update(dt: number): void {
        if(this.tick.tick()) {
            this.health += 1;
            this.stateChanged();
        }
    }
}


// One instance of this corresponds to one RemoteEntity client side
export abstract class NetworkedEntity extends ServerEntity {
    
    abstract packetType: GamePacket;
    readonly id = -1;

    
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




