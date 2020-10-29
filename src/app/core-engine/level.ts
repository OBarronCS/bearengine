
import { Rect } from "../math-library/shapes/rectangle";
import { CustomMapFormat } from "./tiledmapeditor";
import { TerrainManager } from "./terrainmanager";
import { E } from "./globals";
import { utils } from "pixi.js";
import { CollisionManager } from "./entitycollision";

// Current level accessible by "E.Level"
export class LevelHandler {

    data_struct: CustomMapFormat
    loaded = false;
	bbox: Rect;
	
    backgroundColor: string;


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
		const bg = this.backgroundColor = worldInfo.backgroundColor		

		E.Engine.renderer.pixiapp.renderer.backgroundColor = utils.string2hex(bg);
		
		this.terrainManager = new TerrainManager(width, height);
		this.collisionManager = new CollisionManager(width,height);

		this.bbox = new Rect(0,0,width, height);
		
		const bodies = info_struct.bodies // list of bodies

		bodies.forEach( (body) => {
			this.terrainManager.addTerrain(body.points, body.normals)
		});
		
		this.loaded = true
		this.terrainManager.addDraw();
	}

	debugDraw(){
		if(this.loaded){
			// Outline of world
			// this.bbox.draw();
			
			// // Terrain bodies drawn
			// this.terrainManager.debugDraw();
		}
	}
	
	// Immediately ends the level 
	end(){
		this.dispose();
	}

	dispose(){
		
	}
}







