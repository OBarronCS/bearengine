import { BearEngine } from "./bearengine";
import { MouseInput } from "../input/mouse";
import { LevelHandler } from "./level";
import { TerrainManager } from "../../../../shared/core/terrainmanager";
import { EngineKeyboard } from "../input/keyboard";
import { CollisionManager } from "./entitycollision";

// globally accessible as E.

// Just a class so that that naming is nice
// E.
export class E  {
    // Define all names here!
    
    // Later maybe make these getters so can throw error if not ready
    static Engine: BearEngine
    static Mouse: MouseInput;
    static Keyboard: EngineKeyboard;
    static Level: LevelHandler;
    static Terrain: TerrainManager;
    static Collision: CollisionManager;
}


