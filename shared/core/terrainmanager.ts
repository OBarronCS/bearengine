import { Line, lines_intersect } from "shared/shapes/line";
import {  Vec2, Coordinate, distanceSquared, mix, coordinateArraytoVec } from "shared/shapes/vec2";
import { SpatialGrid } from "shared/datastructures/spatialgrid";

import type { Graphics } from "pixi.js";
import { drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Polygon } from "shared/shapes/polygon";



export class TerrainManager {

	private grid: SpatialGrid<Line>;
	
	width: number;
	height: number;
	
	grid_width = 20
	grid_height = 20 

    /// TerrainMesh objects --> the individual bodies --> not really used in any calculations
    terrains: TerrainMesh[] = [];

    constructor(world_width: number, world_height: number){

		this.grid = new SpatialGrid<Line>(world_width, world_height,this.grid_width, this.grid_height,
			(line) => {
			return line.getAABB();
		});

        this.width = world_width
		this.height = world_height;    
    }

	draw(g: Graphics){
		this.terrains.forEach((t) => {
			t.draw(g);
		});

		// this.grid.draw(g); // Draws it with grid lines included, but with the aabbs of the lines
		// const point_test = this.terrains.get(0).pointInPolygon(E.Mouse.position.x, E.Mouse.position.y
		// // green if in, c_red if not!
		// const col = point_test ? "#00FF00" : "#FF0000";
		// drawPoint(E.Mouse.position, utils.string2hex(col));
			// }
	}
	
	/// Adds all terrain info --> adds to grid buckets
	addTerrain(_points: number[], _normals: number[]): void{
		this.terrains.push(new TerrainMesh(_points, _normals));
			
		const _len = _points.length;
		
		// Go through all the points and create temp line objects
		for(let i = 0; i < _len; i += 2){
			let j = i + 2;
			if(j === _len) j = 0;
			const _x1 = _points[i];
			const _y1 = _points[i + 1];
			const _x2 = _points[j];
			const _y2 = _points[j + 1]
			
			const _line = new Line(new Vec2(_x1,_y1), new Vec2(_x2,_y2), new Vec2(_normals[i], _normals[i + 1]))
			this.grid.insert(_line);
		}
	}
	
	// Terrain Raycast
	// return null if no collision, otherwise point of intersection 
	lineCollision(A: Coordinate,B: Coordinate): {point:Vec2,normal:Vec2} {
		const box = (new Line(A,B)).getAABB();
		
		// CHECKS all grid boxes in the lines bounding box.
		// Returns closest point of collision to A or -e
		const possibleCollisions = this.grid.region(box);
		
		let answer:ReturnType<typeof TerrainManager["prototype"]["lineCollision"]> = null;
		let answer_dist = -1;
			
		// This might be a performance barrier --> its a set, not an array. Iterable though
		for(const line of possibleCollisions){

			const t = lines_intersect(A.x, A.y, B.x, B.y, line.A.x, line.A.y, line.B.x, line.B.y, true);
			if(t > 0){
				const _x = A.x + t * (B.x - A.x)
				const _y = A.y + t * (B.y - A.y)
				
				const dist = distanceSquared(A.x, A.y, _x, _y);
				
				// If no answer yet, choose this
				if(answer === null || dist < answer_dist) {
					answer_dist = dist
			
					answer = {
						point:new Vec2(_x, _y),
						normal:line.normal
					}
				}
			}
		}
		
		return answer;
	}

}

// A polygon wrapper with extra functionality 
// special for colliding, mostly static, terrain
class TerrainMesh  {
	public polygon: Polygon;

	constructor(points: number[], normals: number[]){
		this.polygon = new Polygon(coordinateArraytoVec(points),coordinateArraytoVec(normals));
    }


	
	// translate(_dx: number, _dy: number){
	// }
	
	draw(g: Graphics){
		this.polygon.draw(g);
	}
}



