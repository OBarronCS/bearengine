import { Vec2 } from "shared/shapes/vec2";
import { Part } from "./abstractpart";
import { CollisionManager } from "./entitycollision";
import { LevelHandler } from "./level";
import { NULL_ENTITY_INDEX, Scene } from "./scene";
import { TerrainManager } from "./terrainmanager";


interface GlobalData {
    Scene: Scene
    Level: LevelHandler,
    Terrain: TerrainManager;
    Collision: CollisionManager;
}

// Signifies that a certain number is special
export type EntityID = number; 

export abstract class AbstractEntity {
    readonly entityID: EntityID = NULL_ENTITY_INDEX;

    readonly position: Vec2 = new Vec2(0,0);
    readonly parts: Part[] = [];

    get x() { return this.position.x; }
    set x(_x) { this.position.x = _x; }

    get y() { return this.position.y; }
    set y(_y) { this.position.y = _y; }

    protected static GLOBAL_DATA_STRUCT: GlobalData = null;

    get Scene(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Scene }
    get Level(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Level }
    get Terrain(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Terrain }
    get Collision(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Collision }

    addPart<T extends Part>(part: T): T {
        this.parts.push(part);
        part.owner = this;
        return part;
    }

    abstract update(dt: number): void;

    destroySelf(){
        this.Scene.destroyEntity(this);
    }
    
    onAdd(): void {};
    onDestroy(): void {};

    // Intended for us by abstract classes for behind the scenes work
    postUpdate(): void {}
}






