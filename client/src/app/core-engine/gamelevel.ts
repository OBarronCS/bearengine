import { Graphics, Sprite } from "shared/graphics/graphics";

import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { string2hex } from "shared/misc/mathutils";
import { Rect } from "shared/shapes/rectangle";
import { ASSET_FOLDER_NAME, BearEngine, NetworkPlatformGame } from "./bearengine"
import { BoostZone } from "../gamelogic/boostzone";
import { Vec2 } from "shared/shapes/vec2";


export abstract class GameLevel {

    protected game: NetworkPlatformGame;
    protected engine: BearEngine;
    constructor(game: NetworkPlatformGame){
        this.game = game;
        this.engine = game.engine;
    }
    
    readonly spawn_positions: Vec2[] = [];
    public bbox: Rect;

    /** Put null for path if want no data */
    abstract path: string | TiledMap;
    abstract update(dt: number): void;
    protected abstract start(): void;
    protected abstract end(): void;


    internalStart(){
        const engine = this.game.engine;

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
            this.game.terrain.setupGrid(width, height);
            bodies.forEach( (body) => {
                this.game.terrain.addTerrain(body.points, body.normals, body.tag)
            });

            this.game.collisionManager.setupGrid(width, height);

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

            mapdata.boostzones.forEach(b => {
                this.game.temp_level_subset.addEntity(new BoostZone(b.rect, b.dir));
            });

            this.spawn_positions.push(...[...mapdata.spawn_points]);
        }

        this.start();
    }

    internalEnd(){
        
        this.game.temp_level_subset.clear();

        this.end();
    }
}

export class DummyLevel extends GameLevel {

    path: string | TiledMap;

    constructor(game: NetworkPlatformGame, path: string | TiledMap){
        super(game);
        this.path = path;
    }

    start(): void {
        
    }
    
    end(): void {

    }

    update(dt: number): void {

    }
}
