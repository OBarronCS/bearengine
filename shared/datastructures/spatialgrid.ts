import { Graphics } from "pixi.js";
import { clamp } from "shared/miscmath";
import { Rect } from "../shapes/rectangle";
import { drawLineBetweenPoints } from "shared/shapes/shapedrawing";

export class SpatialGrid<T> {

    private AABBFunction: (object: T) => Rect;

    // 2D array of lists of objects
    // Could maybe convert this to just a 1d array of lists, by mapping each 2d coord to a 1d location
    private grid: T[][][] = [];

    // recommened side length of square root of n where n is number of things inserted. 

    private worldWidth: number;
    private worldHeight: number;

    private gridWidth: number;
    private gridHeight: number;

    private tileWidth: number;
    private tileHeight: number;

    /** World dimensions, how many tiles in each axis, */
    constructor(worldWidth: number, worldHeight: number, gridWidth: number, gridHeight: number, AABBfunc: (object: T) => Rect) {
        this.AABBFunction = AABBfunc;
        
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;

        this.tileWidth = worldWidth / gridWidth;
        this.tileHeight = worldHeight / gridHeight;

        for (let i = 0; i < gridWidth; i++) {
            this.grid[i] = []
            
            for(let j = 0; j < gridHeight; j++){
                this.grid[i][j] = []
            }
        }
    }

    public clear(){
        for (let i = 0; i < this.gridWidth; i++) {
            for(let j = 0; j < this.gridHeight; j++){
                this.grid[i][j] = []
            }
        }
    }

    public draw(g: Graphics): void {
        
        for (let i = 0; i < this.gridWidth; i++) {
            for(let j = 0; j < this.gridHeight; j++){
                // Vertical lines
                drawLineBetweenPoints(g,{x: i * this.tileWidth, y: 0},{x: i * this.tileWidth, y: this.worldHeight})

                // horizontal lines
                drawLineBetweenPoints(g,{x: 0, y: j * this.tileHeight},{x: this.worldWidth, y: j * this.tileHeight})

                this.grid[i][j].forEach((val) => {
                    this.AABBFunction(val).draw(g);
                })
            }
        }

        drawLineBetweenPoints(g,{x: this.worldWidth, y: 0},{x: this.worldWidth, y: this.worldHeight})
        drawLineBetweenPoints(g,{x: 0, y: this.worldHeight},{x: this.worldWidth, y:  this.worldHeight})

		// Draw everything the mouse is over
		//var x_index = floor(mouse_x / tile_width);
		//var y_index = floor(mouse_y / tile_height);
		
		//if(x_index >= 0 and x_index < grid_width and y_index >= 0 and y_index < grid_height){
		//	grid[x_index][y_index].forEach(function(e){
		//		e.draw();
		//	})
		//}
    }


    // What if outside everything? Maybe don't add at all
    public insert(obj: T): void {
        const aabb = this.AABBFunction(obj);

        let left_index = Math.floor(aabb.left / this.tileWidth);
		let right_index = Math.floor(aabb.right / this.tileWidth);
		let top_index = Math.floor(aabb.top / this.tileHeight);
		let bot_index = Math.floor(aabb.bot / this.tileHeight);
		
		left_index = clamp(left_index, 0, this.gridWidth - 1);
        right_index = clamp(right_index, 0, this.gridWidth - 1);   
		top_index = clamp(top_index, 0, this.gridHeight - 1);
        bot_index = clamp(bot_index, 0, this.gridHeight - 1);
        
        for(let j = left_index; j <= right_index; j++){
            for(let k = top_index; k <= bot_index; k++){
                const list = this.grid[j][k];
                list.push(obj);
            }
        }
    } 

    // Returns an iterable of all the values that lie in the region
    public region(box: Rect): Iterable<T> {
        // Its a set so there's no repeats. 
        // Might just be faster at the end of the day to make it an array
        // Or when I've implemented a BST use it here.
        const set = new Set<T>();

		let left_index = Math.floor(box.left / this.tileWidth);
		let right_index = Math.floor(box.right / this.tileWidth);
		let top_index = Math.floor(box.top / this.tileHeight);
		let bot_index = Math.floor(box.bot / this.tileHeight);
		
		left_index = clamp(left_index, 0, this.gridWidth - 1)
		right_index = clamp(right_index, 0, this.gridWidth - 1)
		top_index = clamp(top_index, 0, this.gridHeight - 1)
		bot_index = clamp(bot_index, 0, this.gridHeight - 1)
			
        // Goes through all grid boxes in the bounding box,
        // adds all items in them to the iterable
		for(let j = left_index; j <= right_index; j++){
			for(let k = top_index; k <= bot_index; k++){
                const list = this.grid[j][k];
				for(let i = 0; i < list.length; i++){
                    const obj = list[i];
                    set.add(obj);
                }

            }
        }

        return set;
    }
}



