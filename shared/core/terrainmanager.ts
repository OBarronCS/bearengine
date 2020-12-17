import { Line, lines_intersect } from "shared/shapes/line";
import {  Vec2, Coordinate, distanceSquared, mix } from "shared/shapes/vec2";
import { SpatialGrid } from "shared/datastructures/spatialgrid";

import { Graphics } from "pixi.js";
import { drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";



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
	// return null if no collision, Point of intersection otherwise
	lineCollision(A: Coordinate,B: Coordinate): {point:Vec2,normal:Vec2} {
		const box = (new Line(A,B)).getAABB();
		
		// CHECKS all grid boxes in the lines bounding box.
		// Returns closest point of collision to A or -e
		const possibleCollisions = this.grid.region(box);
		
		let answer:{point:Vec2,normal:Vec2} = null;
		let answer_dist = -1;
			
		// This might be a performance barrier --> its a set, not an array. Iterable though
		for(const line of possibleCollisions){

			const t = lines_intersect(A.x, A.y, B.x, B.y, line.A.x, line.A.y, line.B.x, line.B.y, true);
			if(t > 0){
				const _x = A.x + t * (B.x - A.x)
				const _y = A.y + t * (B.y - A.y)
				
				const dist = distanceSquared(A.x, A.y, _x, _y);
				
				// If no answer yet, choose this
				if(answer === null) {
					answer_dist = dist
			
					answer = {
						point: new Vec2(_x, _y),
						normal:line.normal
					}
				} else { // If we already found a collision, check to make sure this one is closer
					if(dist < answer_dist){
						answer_dist = dist;
						answer = {
							point: new Vec2(_x, _y),
							normal:line.normal
						}
					}
				}
			}
		}
		
		return answer;
	}

}

// Right now this does nothing special. TODO: make it a polygon wrapper with extra functionality special for colliding, mostly static, terrain
class TerrainMesh  {
    points: Vec2[] = [];
    normals: Vec2[] = [];

	constructor(_points: number[], _normals: number[]){
    
        for(let i = 0; i < _points.length - 1; i += 2){
            this.points.push(new Vec2(_points[i], _points[i + 1]))
        }
        
        for(let i = 0; i < _normals.length - 1; i += 2){
            this.normals.push(new Vec2(_normals[i], _normals[i + 1]))
        }
    }
	
	// translate(_dx: number, _dy: number){

	// }
	
	//https://wrf.ecse.rpi.edu//Research/Short_Notes/pnpoly.html
	pointInPolygon(testx: number, testy: number): boolean{
		const nvert = this.points.length;
		let i = 0;
		let j = nvert - 1; 
		let c = false;
		for (; i < nvert; j = i++) {
			let point = this.points[i];
			let last_point = this.points[j];
			
			if ( ((point.y>testy) != (last_point.y>testy)) &&
				(testx < (last_point.x-point.x) * (testy-point.y) / (last_point.y-point.y) + point.x) )
			    c = !c;
		}
		return c;
	}
	
	draw(graphics: Graphics){
		const color = "#FF0000";
		const len = this.points.length
		
		for(let i = 0; i < len; i++){
			let j = i + 1;
			if(j == len) j = 0;
			const p1 = this.points[i];
			const p2 = this.points[j]
			
			const half_way = mix(p1, p2, .5);
			
			// TERRAIN ITSELF
			drawLineBetweenPoints(graphics,p1,p2);
			
			// NORMALS
			drawPoint(graphics,half_way)
			drawVecAsArrow(graphics,this.normals[i], half_way.x, half_way.y, 50);
		}
	}
}



