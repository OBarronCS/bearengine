

// Many games live on tilemaps.
// For now, this doesn't deal with graphics yet
// just collision

import type { Graphics } from "pixi.js";
import { floor } from "shared/misc/mathutils";
import { Rect } from "shared/shapes/rectangle";
import { Coordinate } from "shared/shapes/vec2";
import { filledArray } from "./arrayutils";

// Terrain for 2D grids, essentially.
// if cell false, cannot walk on it.

// In future, make it hold integers for different types of tiles and not just a boolean
export class Tilemap {

    private grid: boolean[];

    private width: number;
    private height: number;
    private tileWidth: number;
    private tileHeight: number;
    
    constructor(w: number, h: number, tileWidth: number, tileHeight: number){
        this.width = w;
        this.height = h;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;

        // 1 d so its easier to identify each value
        this.grid = filledArray(h * w, true)
    }

    // converts from two space to 1d index
    two2one(x: number, y: number){
        return (y * this.width) + x;
    }

    // converts from 1d index to 2d space
    one2two(index: number): [number, number] {
        const y = Math.floor(index / this.width)
        return [index - (y * this.width), y];
    }

    setCell(x: number,y: number): void {
        this.grid[this.two2one(x,y)] = false;
    }

    /** Pixels values */
    isSolid(x: number,y: number){
        return !this.grid[ this.two2one(floor(x/this.tileWidth),floor(y/this.tileHeight)) ]
    }

    /** Grid values, not pixels */
    cellIsSolid(x: number,y: number){
        return !this.grid[ this.two2one(x,y) ]
    }

    // this method limits a velocity so that a given rect with a forcasted velocity will not end up in the wall
    // returns the altered velocity vector
    /*
    example use:
        entity.position.add(this.map.potentialMove(entity.collider.rect, desired_velocity))

    // If theres a situation where it would end up in a corner, it takes the horizontal direction as a priority
    */
    potentialMove(bbox: Rect, vel: Coordinate): Coordinate {
        const finalMove = {x: vel.x, y: vel.y }
        // Going right, every box that goes from top right and bot right corner
        
        // check the horizonals.
        if(vel.x > 0){
            const right = floor((bbox.right + vel.x) / this.tileWidth)
            for(let i = floor(bbox.top / this.tileHeight); i <= floor(bbox.bot / this.tileHeight); i++){
                if(this.cellIsSolid(right,i)){
                    //Limits the velocity 
                    // -1, because without it, it would end up one pixel the tile
                    finalMove.x = -1 + (right * this.tileWidth) - bbox.right;
                }
            }
        } else if(vel.x < 0){
            const left = floor((bbox.left + vel.x) / this.tileWidth)
            for(let i = floor(bbox.top / this.tileHeight); i <= floor(bbox.bot / this.tileHeight); i++){
                if(this.cellIsSolid(left,i)){
                    // Couldn't go left! I can only go this far
                    finalMove.x = ((left + 1) * this.tileWidth) - bbox.left;
                }
            }
        }

        if(vel.y > 0){
            const bot = floor((bbox.bot + vel.y) / this.tileHeight);
            for(let i = floor((bbox.left + finalMove.x) / this.tileWidth); i <= floor((bbox.right + finalMove.x) / this.tileWidth); i++){
                if(this.cellIsSolid(i,bot)){
                    // Couldn't go right! I can only go this far
                    finalMove.y = -1 + (bot * this.tileHeight) - bbox.bot;
                }
            }
        } else if(vel.y < 0){
            const top = floor((bbox.top + vel.y) / this.tileHeight)
            for(let i = floor((bbox.left + finalMove.x) / this.tileWidth); i <= floor((bbox.right + finalMove.x) / this.tileWidth); i++){
                if(this.cellIsSolid(i,top)){
                    // Couldn't go left! I can only go this far
                    finalMove.y = ((top + 1) * this.tileHeight) - bbox.top;
                }
            }
        }


        return finalMove;
    }

    draw(g: Graphics){
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){
                const index = this.two2one(i,j);

                // Black if solid
                if(!this.grid[index]){
                    g.beginFill(0x000000);
                } else {
                    g.beginFill(0xFFFFFF)
                }

                g.drawRect(i * this.tileWidth, j * this.tileHeight,this.tileWidth, this.tileHeight);
            }
        }
    }

}
