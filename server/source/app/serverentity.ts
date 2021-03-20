import { AbstractEntity} from "shared/core/abstractentity"
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream";
import { networkedclass_server, networkedvariable } from "./networking/serverentitydecorators";
import { TickTimer } from "shared/ticktimer";

export abstract class ServerEntity extends AbstractEntity {

    // This shouldn't be touched on entities that are not networked
    // Maybe in future make two seperate lists of entities, one for networked and one for not
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




// Another possible ways to do entities: completely manually
export abstract class TestTestTestNetworkedEntity extends ServerEntity {
    abstract serialize(stream: BufferStreamWriter): void;
    abstract deserialize(stream: BufferStreamReader): void;
}




