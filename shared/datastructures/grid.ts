

import { random_int } from "shared/misc/random";
import { filledArray } from "./arrayutils";


// Maybe change into export namespace, or just an object literal {} exported with a name because this class is just used to group these functions 
export class Grid {

    private constructor(){}

    // The type should really be a primitive. 
    static create<T>(defaultValue: T, width: number, height: number){
        const grid: T[][] = [];

        for(let i = 0; i < width; i++){
            grid[i] = filledArray(height, defaultValue);
        }
    }

    static copy<T>(grid: T[][]): T[][] {
        const new_grid: T[][] = [];

        for(let i = 0, n = grid.length; i < n; ++i){
            new_grid[i] = grid[i].slice(0);
        }

        return new_grid;
    }

    static fill<T>(grid: T[][], value: T){
        for(let i = 0, n = grid.length; i < n; ++i){
            grid[i].fill(value);
        }
    }

    static shuffle<T>(grid: T[][]){
        // Fisher-Yates shuffle, but in 2D dimesions
        const width = grid.length;
        const height = grid[0].length;
        for (let i = width - 1; i > 0; i--) {
            for (let j = height - 1; j > 0; j--) {
                const x = random_int(0,i + 1);
                const y = random_int(0,j + 1);
    
                const temp = grid[i][j];
                grid[i][j] = grid[x][y];
                grid[x][y] = temp;
            }
        }
    }

    // // returns some of all values in a region
    // static sum(grid: number[][]): number {

    // }

}


