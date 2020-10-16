import { Line, lines_intersect } from "../math-library/line";
import {  Vec2, Coordinate, distanceSquared, mix } from "../math-library/vec2";
import { clamp } from "../math-library/miscmath";
import { Graphics, utils } from "pixi.js";
import { drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "../math-library/shapedrawing";
import { E } from "./globals";



export class TerrainManager {

	// Used in grid for optimization
	// Right now it will crash if any vertices are outside this range!
	width: number;
	height: number;
	
	grid_width = 20
	grid_height = 20 
	
	tile_width: number;
	tile_height: number;

    // 2d array of arrays of lines
    grid: Line[][][] = [];

    /// TerrainMesh objects --> the individual bodies --> not really used in any calculations...
    terrains: TerrainMesh[] = [];

    constructor(world_width: number, world_height: number){
        this.width = world_width
        this.height = world_height;

        this.tile_width = this.width / this.grid_width;
        this.tile_height = this.height / this.grid_height;

        
        for (let i = 0; i < this.grid_width; ++i) {
            this.grid[i] = []
            
            for(let j = 0; j < this.grid_height; j++){
                this.grid[i][j] = []
            }
        }         
    }

	addDraw(){
		const graphics = new Graphics();

		this.terrains.forEach((t) => {
			t.draw(graphics);
		});

		E.Engine.renderer.addSprite(graphics);
	}	
	
	/// Adds all terrain info --> adds to grid buckets
	addTerrain(_points: number[], _normals: number[]): void{
		this.terrains.push(new TerrainMesh(_points, _normals));
			
		const lines: Line[] = [];
		
		const _len = _points.length;
		
		// Go through all the points and create temp line objects
		for(let i = 0; i < _len; i += 2){
			let j = i + 2;
			if(j == _len) j = 0;
			const _x1 = _points[i];
			const _y1 = _points[i + 1];
			const _x2 = _points[j];
			const _y2 = _points[j + 1]
			
			const _line = new Line(new Vec2(_x1,_y1), new Vec2(_x2,_y2), new Vec2(_normals[i], _normals[i + 1]))
			lines.push(_line);
		}
		
		// Okay now the lines list has all the lines that I need
		// Add it into the grid
		for(let i = 0; i < lines.length; i++){
			const line = lines[i];
			const box = line.getAABB();
            
            // Might just wanna clamp these idk
			const left_index = Math.floor(box.left / this.tile_width);
			const right_index =  Math.floor(box.right / this.tile_width);
			const top_index =  Math.floor(box.top / this.tile_height);
			const bot_index =  Math.floor(box.bot / this.tile_height);
			
			for(let j = left_index; j <= right_index; j++){
				for(let k = top_index; k <= bot_index; k++){
					// Adds the line to the AABB collision grid
					const list = this.grid[j][k];
					list.push(line)
				}
			}
		}
	}
	
	
	/// return -1 if no collision, Point of intersection otherwise
	lineCollision(A: Coordinate,B: Coordinate): {point:Vec2,normal:Vec2}{
		const box = (new Line(A,B)).getAABB();
		let left_index = Math.floor(box.left / this.tile_width);
		let right_index = Math.floor(box.right / this.tile_width);
		let top_index = Math.floor(box.top / this.tile_height);
		let bot_index = Math.floor(box.bot / this.tile_height);
		
		left_index = clamp(left_index, 0, this.grid_width - 1)
		right_index = clamp(right_index, 0, this.grid_width - 1)
		top_index = clamp(top_index, 0, this.grid_height - 1)
		bot_index = clamp(bot_index, 0, this.grid_height - 1)
			
		// 	CHECKS all grid boxes in the lines bounding box.
		// Returns closest point of collision to A or -e
		
		let answer:{point:Vec2,normal:Vec2}  = null;
		let answer_dist = -1;
			
		for(let j = left_index; j <= right_index; j++){
			for(let k = top_index; k <= bot_index; k++){
				// Gets the list of lines it could have collided with
				const lineList = this.grid[j][k];
				
				const len = lineList.length;
				
				for(let i = 0; i < len; i++){
					const line = lineList[i];
					const t = lines_intersect(A.x, A.y, B.x, B.y, line.A.x, line.A.y, line.B.x, line.B.y, true);
					if(t > 0){
						const _x = A.x + t * (B.x - A.x)
						const _y = A.y + t * (B.y - A.y)
						
						const dist = distanceSquared(A.x, A.y, _x, _y);
						
						// If no answer yet, choose this
						if(answer === null){
				
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
			}
		}
		
		return answer;
	}
	
	draw(){		
		//draw_set_color(c_black)
		//for (var i = 0; i < 5; ++i) {
		//    draw_line(i * tile_width, 0, i * tile_width, tile_height * 3)
		//}
		
		//for (var i = 0; i < 4; ++i) {
		//    draw_line(0, i * tile_height, 4 * tile_width, tile_height * i)
		//}
		
		
		// const point_test = this.terrains.get(0).pointInPolygon(E.Mouse.position.x, E.Mouse.position.y)

		// // green if in, c_red if not!
		// const col = point_test ? "#00FF00" : "#FF0000";

		// drawPoint(E.Mouse.position, utils.string2hex(col));

		
		// TEST
		//var x_index = floor(mouse_x / tile_width);
		//var y_index = floor(mouse_y / tile_height);
		
		//if(x_index >= 0 and x_index < grid_width and y_index >= 0 and y_index < grid_height){
		//	grid[x_index][y_index].forEach(function(e){
		//		e.draw();
		//	})
		//}
		
	}
	
}



/// @func TerrainMesh(_points, _normals)
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
	// 	for(let i = 0; i < this.points.length; i += 2){
	// 		this.points[i] += _dx;
	// 		this.points[i + 1] += _dy
	// 	}
	// }
	
    // A B are Vec2 objects defining two points that create a line segment
    // not actually in use rn maybe soon tho
	// lineCollision = function(A, B){
	// 	var len = Arrays.length(points);
		
	// 	for(var i = 0; i < len; i++){
	// 		var j = i + 1;
	// 		if(j == len) j = 0;
	// 		var p1 = points[i];
	// 		var p2 = points[j]

	// 		var t = lines_intersect(A.x, A.y, B.x, B.y, p1.x, p1.y, p2.x, p2.y, true);
	// 		if(t > 0){
	// 			return t;
	// 		}
	// 	}
		
	// 	return -1;
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
	
	//E.Engine.renderer.addSprite(this.container);
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



