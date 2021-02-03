import { Vec2 } from "shared/shapes/vec2";
import { Part } from "./abstractpart";
import { CollisionManager } from "./entitycollision";
import { LevelHandler } from "./level";
import { TerrainManager } from "./terrainmanager";


// Client and Server should subclass this

interface GlobalData {
    Scene: {
        addEntity<T extends AbstractEntity>(entity: T): T;
        destroyEntity<T extends AbstractEntity>(entity: T): void;
    }
    Level: LevelHandler,
    Terrain: TerrainManager;
    Collision: CollisionManager;
}


export abstract class AbstractEntity {
    readonly position: Vec2 = new Vec2(0,0)
    readonly parts: Part[] = [];

    get x() { return this.position.x; }
    get y() { return this.position.y; }

    set x(_x) { this.position.x = _x; }
    set y(_y) { this.position.y = _y; }


    static GLOBAL_DATA_STRUCT: GlobalData = null;

    get Scene(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Scene }
    get Level(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Level }
    get Terrain(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Terrain }
    get Collision(){ return AbstractEntity.GLOBAL_DATA_STRUCT.Collision }

    
    addPart<T extends Part>(part: T): T {
        this.parts.push(part);
        part.owner = this;
        return part;
    }

    updateParts(dt: number){
        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            part.update(dt);
        }
    }

    abstract update(dt: number): void;
    
    onAdd(): void {};
    onDestroy(): void {};

    // Intended for us by abstract classes for behind the scenes work
    postUpdate(): void {}
}






