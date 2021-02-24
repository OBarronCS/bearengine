
import { Rect } from "shared/shapes/rectangle";
import { CustomMapFormat } from "shared/core/tiledmapeditor";
import { TerrainManager } from "shared/core/terrainmanager";
import { CollisionManager } from "shared/core/entitycollision";
import { Subsystem } from "./subsystem";

import type { Graphics } from "pixi.js";


export class LevelHandler extends Subsystem {


    public data_struct: CustomMapFormat = null;
    public loaded = false;
	public bbox: Rect;

	public terrainManager: TerrainManager = null;
	public collisionManager: CollisionManager = null;


	init(): void {
		
	}

	update(dt: number): void {
		this.collisionManager.update(dt);
	}

	// Loads and starts the level
	load(data_struct: CustomMapFormat){
		this.data_struct = data_struct;
        
		const worldInfo = data_struct.world;
		const width = worldInfo.width;
		const height = worldInfo.height;	

		
		this.terrainManager = new TerrainManager(width,height);
		this.collisionManager = new CollisionManager(width,height);

		this.bbox = new Rect(0,0,width,height);
		
		const bodies = data_struct.bodies // list of bodies

		bodies.forEach( (body) => {
			this.terrainManager.addTerrain(body.points, body.normals)
		});
		
		this.loaded = true

		this.addExistingQuery(this.collisionManager.part_query);
	}

	draw(g: Graphics){
		this.terrainManager.draw(g);
	}
	
	// Immediately ends the level 
	end(){
		this.dispose();
	}

	dispose(){
		
	}
}







