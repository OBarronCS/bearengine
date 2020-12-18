import { CollisionManager } from "shared/core/entitycollision";
import { LevelHandler } from "shared/core/level";
import { TerrainManager } from "shared/core/terrainmanager";
import { ServerBearEngine } from "./serverengine";



export class SE  {
    // Define all names here!
    
    // Later maybe make these getters so can throw error if not ready
    static Engine: ServerBearEngine
    static Level: LevelHandler;
    static Terrain: TerrainManager;
    static Collision: CollisionManager;
}


