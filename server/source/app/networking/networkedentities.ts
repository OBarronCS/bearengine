import { ServerEntity } from "../entity";
import { networkedclass_server, sync } from "./serverentitydecorators";


@networkedclass_server("ogre")
class ServerOgre extends ServerEntity {
    @sync("ogre").var("_x")
    _x = 1;

    @sync("ogre").var("asdasd")
    asdasd = 1;
    
    update(dt: number): void {

    }
}


