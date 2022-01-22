import type { Graphics } from "shared/graphics/graphics";
import { clamp } from "shared/misc/mathutils";
import { Rect } from "../shapes/rectangle";
import { drawLineBetweenPoints } from "shared/shapes/shapedrawing";
import { Coordinate } from "shared/shapes/vec2";

export class SpatialGrid<T> {

    private AABBFunction: (object: T) => Rect;


    private grid: T[][] = [];

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

        for (let i = 0; i < gridWidth * this.gridHeight; i++) {
            this.grid[i] = [];
        }
    }

    public clear(){
        for (let i = 0; i < this.gridWidth * this.gridHeight; i++) {
            if(this.grid[i].length > 0) this.grid[i] = [];
        }
    }

    public draw(g: Graphics): void {

        const set = new Set<T>();
        
        for (let i = 0; i < this.gridWidth; i++) {
            for(let j = 0; j < this.gridHeight; j++){
                // Vertical lines
                drawLineBetweenPoints(g,{x: i * this.tileWidth, y: 0},{x: i * this.tileWidth, y: this.worldHeight}, undefined, .01,)

                // horizontal lines
                drawLineBetweenPoints(g,{x: 0, y: j * this.tileHeight},{x: this.worldWidth, y: j * this.tileHeight}, undefined, .01)


                const list = this.grid[j + this.gridHeight + i];
                for(const obj of list)
                    set.add(obj);
            }
        }

        set.forEach((val) => {
            this.AABBFunction(val).draw(g, 0x00FF00, 8, .3);
        });

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

    public remove(obj: T): void {
        const aabb = this.AABBFunction(obj);

        let left_index = Math.floor(aabb.left / this.tileWidth);
        let right_index = Math.floor(aabb.right / this.tileWidth);
        let top_index = Math.floor(aabb.top / this.tileHeight);
        let bot_index = Math.floor(aabb.bot / this.tileHeight);
        
        left_index = clamp(left_index, 0, this.gridWidth - 1);
        right_index = clamp(right_index, 0, this.gridWidth - 1);   
        top_index = clamp(top_index, 0, this.gridHeight - 1);
        bot_index = clamp(bot_index, 0, this.gridHeight - 1);
        
        // Used for debugging
        let num = 0;

        for(let j = top_index; j <= bot_index; j++){
            for(let i = left_index; i <= right_index; i++){
                const list = this.grid[j*this.gridWidth + i];

                const index = list.indexOf(obj);
                if(index !== -1){
                    num += 1;
                    list.splice(index,1);
                }   
            }
        }

        // for(let j = left_index; j <= right_index; j++){
        //     for(let k = top_index; k <= bot_index; k++){
        //         const list = this.grid[j][k];
        //         const index = list.indexOf(obj);
        //         if(index !== -1){
        //             num += 1;
        //             list.splice(index,1);
        //         }   
        //     }
        // }

        if(num === 0) console.trace("Deleting unknown object: " + obj);
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
        
        for(let j = top_index; j <= bot_index; j++){
            for(let i = left_index; i <= right_index; i++){
                const list = this.grid[j*this.gridWidth + i];
                list.push(obj);
            }
        }


        // for(let j = left_index; j <= right_index; j++){
        //     for(let k = top_index; k <= bot_index; k++){
        //         const list = this.grid[j][k];
        //         list.push(obj);
        //     }
        // }
    } 

    // Returns an iterable of all the values that lie under a region
    public point(p: Coordinate): readonly T[] {
        let x_index = Math.floor(p.x / this.tileWidth);
        let y_index = Math.floor(p.y / this.tileHeight);
        
        x_index = clamp(x_index, 0, this.gridWidth - 1)
        y_index = clamp(y_index, 0, this.gridWidth - 1)


        return this.grid[y_index * this.gridWidth + x_index];
    }

    /* Returns alls the values that lie in the region. No repeats */
    public region(box: Rect): Iterable<T> {


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

        // Its a set so there's no repeats. 
        // Might just be faster at the end of the day to make it an array
        // Or when I've implemented a BST use it here.
        const set = new Set<T>();

        for(let j = top_index; j <= bot_index; j++){
            for(let i = left_index; i <= right_index; i++){
                const list = this.grid[j*this.gridWidth + i];
                for(const v of list){
                    set.add(v);
                }
            }
        }

        // for(let j = left_index; j <= right_index; j++){
        //     for(let k = top_index; k <= bot_index; k++){
        //         const list = this.grid[j][k];
        //         for(let i = 0; i < list.length; i++){
        //             const obj = list[i];
        //             set.add(obj);
        //         }

        //     }
        // }

        return set;
    }
}



