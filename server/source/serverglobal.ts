import { BearEngine } from "../../src/app/core-engine/bearengine";
import { CollisionManager } from "../../src/app/core-engine/entitycollision";
import { LevelHandler } from "../../src/app/core-engine/level";
import { TerrainManager } from "../../src/app/core-engine/terrainmanager";
import { ServerBearEngine } from "./serverengine";


export class ServerE  {
    // Define all names here!
    
    // Later maybe make these getters so can throw error if not ready
    static Engine: ServerBearEngine
    static Level: LevelHandler;
    static Terrain: TerrainManager;
    static Collision: CollisionManager;
}


