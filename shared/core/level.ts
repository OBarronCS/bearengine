
import { Rect } from "shared/shapes/rectangle";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";
import { Subsystem } from "./subsystem";


// Consider just deleting this class
export class LevelHandler extends Subsystem {

    // this class used to contain handles to terrain and collision managers, but I made them systems.
    public data_struct: CustomMapFormat = null;
    public loaded = false;
    public bbox: Rect;


    init(): void {}
    update(dt: number): void {}

    // Loads and starts the level
    startLevel(data_struct: CustomMapFormat){
        this.data_struct = data_struct;
        
        const worldInfo = data_struct.world;
        const width = worldInfo.width;
        const height = worldInfo.height;

        this.bbox = new Rect(0,0,width,height);
        
        const bodies = data_struct.bodies;

        const terrain = this.getSystem(TerrainManager);
        terrain.setupGrid(width, height);

        const collision = this.getSystem(CollisionManager);
        collision.setupGrid(width, height);

        bodies.forEach( (body) => {
            terrain.addTerrain(body.points, body.normals)
        });
        
        this.loaded = true;
    }
    
    // Immediately ends the level 
    end(){
        
    }
}







