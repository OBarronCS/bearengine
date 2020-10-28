

import { Graphics, utils } from "pixi.js";
import { clamp } from "./miscmath";
import { Rect } from "./shapes/rectangle";


export class QuadTree<T> {
    
    // Max number of values per node
    public bucketSize = 3;
    public maxDepth = 8;

    private root: QuadNode<T>;

    private AABBFunction: (object: T) => Rect;

    // Assumes world starts at origin, no negative values
    private worldWidth: number;
    private worldHeight: number;

    constructor(worldWidth: number, worldHeight: number, AABBfunc: (object: T) => Rect) {
        this.AABBFunction = AABBfunc;
        
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        this.root = new QuadNode<T>();
        this.root.aabb = new Rect(0,0,worldWidth,worldHeight);
    }

    public insert(obj: T, node: QuadNode<T> = this.root, depth = 0): void {
        // Modifies it, assumes this returns a copy;
        const aabb = this.AABBFunction(obj);

		aabb.left = clamp(aabb.left, 0, this.worldWidth);
        aabb.right = clamp(aabb.right, 0, this.worldWidth);   
        aabb.top = clamp(aabb.top, 0, this.worldHeight);
        aabb.bot = clamp(aabb.bot, 0, this.worldHeight);
        
        this.put(node, obj, aabb,depth);
    } 
    
    // Recursively finds the small node to put this into
    private put(node: QuadNode<T>, obj: T, aabb: Rect, depth: number){
        if(node === null) return;
        if(!aabb.intersects(node.aabb)) return;
        
                // Either a node has 0 or 4 children. Just need to check one.
        if(node.NE !== null){
            this.put(node.NE, obj, aabb, depth + 1);
            this.put(node.NW, obj, aabb, depth + 1);
            this.put(node.SE, obj, aabb, depth + 1);
            this.put(node.SW, obj, aabb, depth + 1);
        } else {
            node.values.push(obj);
            if(node.values.length > this.bucketSize && depth < this.maxDepth) {
                this.split(node, depth);
            }
        }
    }
    
    // Adds 4 subnodes to a node and puts its contents inside of them
    private split(node: QuadNode<T>, depth: number){
        node.NE = new QuadNode<T>();
        const ne_rect = node.aabb.clone();
        ne_rect.left = (ne_rect.left + ne_rect.right) / 2;
        ne_rect.bot = (ne_rect.top + ne_rect.bot) / 2;
        node.NE.aabb = ne_rect;

        node.NW = new QuadNode<T>();
        const nw_rect = node.aabb.clone();
        nw_rect.right = (nw_rect.left + nw_rect.right) / 2;
        nw_rect.bot = (nw_rect.top + nw_rect.bot) / 2;
        node.NW.aabb = nw_rect;

        node.SE = new QuadNode<T>();
        const se_rect = node.aabb.clone();
        se_rect.left = (se_rect.left + se_rect.right) / 2;
        se_rect.top = (se_rect.top + se_rect.bot) / 2;
        node.SE.aabb = se_rect;

        node.SW = new QuadNode<T>();
        const sw_rect = node.aabb.clone();
        sw_rect.right = (sw_rect.left + sw_rect.right) / 2;
        sw_rect.top = (sw_rect.top + sw_rect.bot) / 2;
        node.SW.aabb = sw_rect;

        for(const value of node.values){
            // Automatically adds the value into this subnode which will go into these new child nodes
            this.insert(value, node, depth);
        }

        node.values = [];
    }


    public draw(g: Graphics, node: QuadNode<T> = this.root): void {
        if(node === null) return;

        node.aabb.draw(g,undefined,6);

        for(const value of node.values){
            this.AABBFunction(value).draw(g,utils.string2hex("#FF0000"));
        }

        this.draw(g, node.NE);
        this.draw(g, node.NW);
        this.draw(g, node.SE);
        this.draw(g, node.SW);
    }
}

class QuadNode<T> {
    NE: QuadNode<T> = null;
    NW: QuadNode<T> = null;
    SE: QuadNode<T> = null;
    SW: QuadNode<T> = null;

    // The rectangle that inhabits this square
    aabb: Rect;

    values: T[] = [];
}


