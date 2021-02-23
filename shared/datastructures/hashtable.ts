import type { Graphics } from "pixi.js";
import { swap } from "./arrayutils";
import { Rect } from "../shapes/rectangle";
import { clamp } from "shared/miscmath";
import { drawLineBetweenPoints } from "shared/shapes/shapedrawing";

// Resolution with chaining;
export class HashMapChain<T> {
    private arr: MiniLink<T>[] = [];
    private length = 10;

    constructor(){
        this.arr.length = 10;
        this.arr.fill(null);
    }

    public put(key: number, value: T){
        this.insert(this.hash(key), key, value);
    }
    
    private hash(key: number): number {
        return key % this.length;
    }

    /** null if doesn't contain */
    public get(key: number): T{
        const index = this.hash(key);
        for(let n = this.arr[index]; n !== null; n = n.next){
            if(n.key === key) return n.value;
        }

        return null;
    }

    private insert(index:number, key: number, value: T){
        // Check if we already this key here. If so, replace the value
        for(let n = this.arr[index]; n !== null; n = n.next){
            if(n.key === key) {
                n.value = value;
                return;
            }
        } 

        // New value, add it to the list!
        this.arr[index] = new MiniLink(key, value, this.arr[index]);
    }
}

class MiniLink<T> {
    constructor(
        public key: number,
        public value: T,
        public next: MiniLink<T>
    ){}
}


// Linear probing HashMap
export class HashMapLinear<T> {
    private arr: KeyValuePair<T>[] = [];
    private amount = 0;
    private baseCapacity: number;
    
    // The max amount of items can hold because resize, double
    private capacityPercent: number;


    constructor(capacity = 11, capacityPercent = .5){
        this.baseCapacity = capacity;
        this.arr.length = capacity;
        this.arr.fill(null);
        this.capacityPercent = capacityPercent;
    }

    public clear(capacity = this.arr.length){
        this.arr.fill(null)
        this.arr.length = capacity;
    }

    public size(){
        return this.amount;
    }

    public put(key: number, value: T){
        let index = this.hash(key);
        for(; this.arr[index] !== null; index %= this.arr.length){
            if(this.arr[index].key === key) {
                this.arr[index].value = value;
                return;
            }
            index++;
        }

        this.amount += 1;
        // Instead of this, I could have two parrallel arrays
        // this is easier, simpler to implement new features
        this.arr[index] = new KeyValuePair(key, value);

        if(this.amount >= this.arr.length * this.capacityPercent){
            this.resize(this.arr.length / this.capacityPercent);
        }
    }
    
    // returns the main index they key should go in
    private hash(key: number): number {
        return key % this.arr.length;
    }

    /** null if doesn't contain */
    public get(key: number): T {
        let index = this.hash(key);
        while(this.arr[index %= this.arr.length] !== null) {
            if(this.arr[index].key === key) return this.arr[index].value;

            index++;
        }

        return null;
    }

    public delete(key: number): T {
        let index = this.hash(key);

        // Its a eight full, not empty, resize to half
        if(this.arr.length >= this.baseCapacity / this.capacityPercent && this.amount <= this.arr.length * this.capacityPercent / 4) this.resize(this.arr.length * this.capacityPercent)

        // First find the index we want
        while(this.arr[index %= this.arr.length] !== null) {
            if(this.arr[index].key === key) {
                
                this.amount -= 1;
 
                const answer = this.arr[index].value;

                this.arr[index] = null;

                index++;
                
                // This moves everything back to take up the space
                let lastIndex = index - 1;
                while(this.arr[index %= this.arr.length] !== null){
                    const hash = this.hash(this.arr[index].key);
                                     
                    if(hash <= lastIndex && hash !== index)
                        swap(this.arr, index, lastIndex);
                    else 
                        break;
                    
                    lastIndex = index++;
                }

                return answer;
            }
            
            index++;
        }

        return null;
    }

    // to get keys iterator, just iterate thorugh entire array (O(n))

    private resize(new_size: number): void {
        const values = this.arr.slice(0);

        // this first line might be useless. No point in making a new array
        this.arr = [];
        this.arr.length = Math.floor(new_size);
        this.arr.fill(null);

        for(let i = 0; i < values.length; i++){
            if(values[i] !== null){
                this.put(values[i].key, values[i].value);
                this.amount -= 1;
            }
        }
    }
}

class KeyValuePair<T> {
    constructor(
        public key: number,
        public value: T
    ){}
}

// Primes 0 to 3000 
const primes = 
[
2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997, 1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049, 1051, 1061, 1063, 1069, 1087, 1091, 1093, 1097, 1103, 1109, 1117, 1123, 1129, 1151, 1153, 1163, 1171, 1181, 1187, 1193, 1201, 1213, 1217, 1223, 1229, 1231, 1237, 1249, 1259, 1277, 1279, 1283, 1289, 1291, 1297, 1301, 1303, 1307, 1319, 1321, 1327, 1361, 1367, 1373, 1381, 1399, 1409, 1423, 1427, 1429, 1433, 1439, 1447, 1451, 1453, 1459, 1471,
1481, 1483, 1487, 1489, 1493, 1499, 1511, 1523, 1531, 1543, 1549, 1553, 1559, 1567, 1571, 1579, 1583, 1597, 1601, 1607, 1609, 1613, 1619, 1621, 1627, 1637, 1657, 1663, 1667, 1669, 1693, 1697, 1699, 1709, 1721, 1723, 1733, 1741, 1747, 1753, 1759, 1777, 1783, 1787, 1789, 1801, 1811, 1823, 1831, 1847, 1861, 1867, 1871, 1873, 1877, 1879, 1889, 1901, 1907, 1913, 1931, 1933, 1949, 1951, 1973, 1979, 1987, 1993, 1997, 1999, 2003, 2011, 2017, 2027, 2029, 2039, 2053, 2063, 2069, 2081, 2083, 2087, 2089, 2099, 2111, 2113, 2129, 2131, 2137, 2141, 2143, 2153, 2161, 2179, 2203, 2207, 2213, 2221, 2237, 2239, 2243, 2251, 2267, 2269, 2273, 2281, 2287, 2293, 2297, 2309, 2311, 2333, 2339, 2341, 2347, 2351, 2357, 2371, 2377, 2381, 2383, 2389, 2393, 2399, 2411, 2417, 2423, 2437, 2441, 2447, 2459, 2467, 2473, 2477, 2503, 2521, 2531, 2539, 2543, 2549, 2551, 2557, 2579, 2591, 2593, 2609, 2617, 2621, 2633, 2647, 2657, 2659, 2663, 2671, 2677, 2683, 2687, 2689, 2693, 2699, 2707, 2711, 2713, 2719, 2729, 2731, 2741, 2749, 2753, 2767, 2777, 2789, 2791, 2797, 2801, 2803, 2819, 2833, 2837, 2843, 2851, 2857, 2861, 2879, 2887, 2897, 2903, 2909, 2917, 2927, 2939, 2953, 2957, 2963, 2969, 2971, 2999
]

// Basically a sparse matrix without iteration
export class SparseGrid<T> {
    private AABBFunction: (object: T) => Rect;

    private worldWidth: number;
    private worldHeight: number;

    private gridWidth: number;
    private gridHeight: number;

    private tileWidth: number;
    private tileHeight: number;

    private hashmap: HashMapLinear<T[]>;

    /** World dimensions, how many tiles in each axis, */
    constructor(worldWidth: number, worldHeight: number, gridWidth: number, gridHeight: number, AABBfunc: (object: T) => Rect) {
        this.AABBFunction = AABBfunc;
        
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;

        this.tileWidth = worldWidth / gridWidth;
        this.tileHeight = worldHeight / gridHeight;
        
        //research optimal size for this
        this.hashmap = new HashMapLinear(47, 0.65);
    }

    // converts from two space to 1d index
    two2one(x: number, y: number){
        return (y * this.worldWidth) + x;
    }

    // converts from 1d index to 2d space
    one2two(index: number): [ number, number] {
        const y = Math.floor(index / this.worldWidth)
        return [index - (y * this.worldWidth), y];
    }

    // Very in-efficient, because of hashmap iteration
    public draw(g: Graphics): void {
        for (let i = 0; i < this.gridWidth; i++) {
            for(let j = 0; j < this.gridHeight; j++){
                // Vertical lines
                drawLineBetweenPoints(g,{x: i * this.tileWidth, y: 0},{x: i * this.tileWidth, y: this.worldHeight})

                // horizontal lines
                drawLineBetweenPoints(g,{x: 0, y: j * this.tileHeight},{x: this.worldWidth, y: j * this.tileHeight})

                const list = this.hashmap.get(this.two2one(i,j));
                if(list !== null) list.forEach(val => {
                    this.AABBFunction(val).draw(g);
                });
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

    public clear(){
        this.hashmap.clear(47);
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
                const index = this.two2one(j,k);

                if(this.hashmap.get(index) === null) this.hashmap.put(index, []);
                
                this.hashmap.get(index).push(obj);
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
                const index = this.two2one(j,k);
                const list = this.hashmap.get(index);
                if(list !== null){
                    for(let i = 0; i < list.length; i++) set.add(list[i]);
                }
            }
        }

        return set;
    }
}

