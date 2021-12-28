import { networkedclass_server, NetworkedEntity, sync } from "./serverentitydecorators";




@networkedclass_server("ogre")
export class ServerOgre extends NetworkedEntity<"ogre"> {
    @sync("ogre").var("_x")
    _x = 1;

    @sync("ogre").var("asdasd")
    asdasd = 1;
    
    update(dt: number): void {

    }
}



