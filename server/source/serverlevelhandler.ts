
import { Rect } from "shared/shapes/rectangle";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { TerrainManager } from "shared/core/terrainmanager";
import { Graphics, utils } from "pixi.js";

import { CollisionManager } from "./entitycollision";



// Current level accessible by "SE.Level"
export class LevelHandler {

    data_struct: CustomMapFormat
    loaded = false;
	bbox: Rect;

	terrainManager: TerrainManager = null;
	collisionManager: CollisionManager = null;

    constructor(data_struct: CustomMapFormat){
        this.data_struct = data_struct;
    }

	// Loads and starts the  level
	load(){
		const info_struct = this.data_struct;
        
		const worldInfo = info_struct.world;
		const width = worldInfo.width;
		const height = worldInfo.height;
		
		this.terrainManager = new TerrainManager(width, height);
		this.collisionManager = new CollisionManager(width,height);

		this.bbox = new Rect(0,0,width, height);
		
		const bodies = info_struct.bodies // list of bodies

		bodies.forEach( (body) => {
			this.terrainManager.addTerrain(body.points, body.normals)
		});
		
		this.loaded = true
	}
	
	// Immediately ends the level 
	end(){
		this.dispose();
	}

	dispose(){
		
	}
}







