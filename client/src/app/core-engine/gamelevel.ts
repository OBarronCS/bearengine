import { Graphics, Sprite } from "pixi.js";
import { EntitySystem } from "shared/core/entitysystem";

import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { string2hex } from "shared/misc/mathutils";
import { Rect } from "shared/shapes/rectangle";
import { ASSET_FOLDER_NAME, BearEngine, NetworkPlatformGame } from "./bearengine"
import { Entity } from "./entity";


export abstract class GameLevel {

    public bbox: Rect;

    /** Put null for path if want no data */
    abstract path: string | TiledMap
    abstract update(dt: number): void;
    protected abstract start(engine: NetworkPlatformGame, scene: EntitySystem): void;
    protected abstract end(engine: NetworkPlatformGame): void;


    internalStart(game: NetworkPlatformGame, scene: EntitySystem){
        const engine = game.engine;

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
            game.terrain.setupGrid(width, height);
            bodies.forEach( (body) => {
                game.terrain.addTerrain(body.points, body.normals)
            });

            game.collisionManager.setupGrid(width, height);

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

        // const graphics = engine.renderer.createCanvas();
        game.terrain.graphics = new Graphics();
        engine.renderer.addSprite(game.terrain.graphics);
        game.terrain.queueRedraw();

        this.start(game, scene);
    }

    internalEnd(game: NetworkPlatformGame){

        game.engine.renderer.removeSprite(game.terrain.graphics);
        this.end(game);
    }
}

export class DummyLevel extends GameLevel {

    path: string | TiledMap;

    constructor(path: string | TiledMap){
        super();
        this.path = path;
    }

    start(engine: NetworkPlatformGame, scene: EntitySystem<Entity>): void {
        
    }
    end(engine: NetworkPlatformGame): void {

    }
    update(dt: number): void {

    }


}