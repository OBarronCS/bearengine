import { ServerBearEngine } from "./serverengine";
import { LevelHandler } from "../../client/src/app/core-engine/level"
import { CollisionManager } from "client/src/app/core-engine/entitycollision";


import { TerrainManager } from "./core/terrainmanager";


export class SE  {
    // Define all names here!
    
    // Later maybe make these getters so can throw error if not ready
    static Engine: ServerBearEngine
    static Level: LevelHandler;
    static Terrain: TerrainManager;
    static Collision: CollisionManager;
}


