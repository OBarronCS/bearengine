import { AbstractEntity } from "shared/core/abstractentity";
import { ServerBearEngine } from "./serverengine";

export abstract class ServerEntity extends AbstractEntity<ServerBearEngine> {

    // This shouldn't be touched on entities that are not networked
    // Maybe in future make two seperate lists of entities, one for networked and one for not
    stateHasBeenChanged = false;

    markDirty(): void {
        this.stateHasBeenChanged = true;
    }
}
