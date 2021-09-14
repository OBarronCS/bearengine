import { AbstractEntity } from "shared/core/abstractentity";
import { ServerBearEngine } from "./serverengine";

export abstract class ServerEntity extends AbstractEntity<ServerBearEngine> {

    // This shouldn't be touched on entities that are not networked
    stateHasBeenChanged = false;

    markDirty(): void {
        this.stateHasBeenChanged = true;
    }
}
