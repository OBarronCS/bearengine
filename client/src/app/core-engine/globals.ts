
import { LevelHandler } from "shared/core/level";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";

import { BearEngine } from "./bearengine";
import { MouseInput } from "../input/mouse";
import { EngineKeyboard } from "../input/keyboard";

// globally accessible as E.
// Just a class so that that naming is nice
// E.
export class E  {

    // Later maybe make these getters so can throw error if not ready
    static Engine: BearEngine
    static Mouse: MouseInput;
    static Keyboard: EngineKeyboard;
    static Level: LevelHandler;
    static Terrain: TerrainManager;
    static Collision: CollisionManager;
}


