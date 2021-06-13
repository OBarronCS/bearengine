import { Graphics, Sprite } from "pixi.js";
import { Scene } from "shared/core/scene";

import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { string2hex } from "shared/mathutils";
import { Rect } from "shared/shapes/rectangle";
import { ASSET_FOLDER_NAME, BearEngine } from "./bearengine"
import { Entity } from "./entity";


export abstract class GameLevel {

    public bbox: Rect;

    /** Put null for path if want no data */
    abstract path: string | TiledMap
    protected abstract start(engine: BearEngine, scene: Scene): void;
    protected abstract end(engine: BearEngine): void;
    abstract update(dt: number): void;

    internalStart(engine: BearEngine, scene: Scene){

        const tiled = typeof this.path === "string" ? 
            engine.getResource(this.path).data as TiledMap :
            this.path;

        // Load the level data from file;
        if(tiled !== null){
            const mapdata = ParseTiledMapData(tiled);
        
            
            // Create terrain and world size
            const worldInfo = mapdata.world;
            const width = worldInfo.width;
            const height = worldInfo.height;

            this.bbox = new Rect(0,0,width,height);
            
            const bodies = mapdata.bodies;
            engine.terrain.setupGrid(width, height);
            bodies.forEach( (body) => {
                engine.terrain.addTerrain(body.points, body.normals)
            });

            engine.collisionManager.setupGrid(width, height);

            engine.renderer.renderer.backgroundColor = string2hex(mapdata.world.backgroundcolor);
            // Load sprites from map 
            mapdata.sprites.forEach(s => {
                const sprite = new Sprite(engine.renderer.getTexture(ASSET_FOLDER_NAME + s.file_path));
                sprite.x = s.x;
                sprite.y = s.y;
                sprite.width = s.width;
                sprite.height = s.height;
                engine.renderer.addSprite(sprite)
            });
        }

        engine.terrain.graphics = new Graphics();
        engine.renderer.addSprite(engine.terrain.graphics);
        engine.terrain.queueRedraw();

        this.start(engine, scene);
    }

    internalEnd(engine: BearEngine){

        this.end(engine);
    }
}

export class DummyLevel extends GameLevel {

    path: string | TiledMap;

    constructor(path: string | TiledMap){
        super();
        this.path = path;
    }

    start(engine: BearEngine, scene: Scene<Entity>): void {
        
    }
    end(engine: BearEngine): void {

    }
    update(dt: number): void {

    }


}