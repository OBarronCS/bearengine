


import type { Graphics } from "shared/graphics/graphics";
import { rgb } from "./color";
import { clamp, isPow2, string2hex } from "shared/misc/mathutils";
import { ModifiablePQ } from "./priorityqueue";
import { Rect } from "../shapes/rectangle";
import { drawLineBetweenPoints } from "shared/shapes/shapedrawing";
import { Vec2 } from "../shapes/vec2";
import { LinkedStack } from "./stack";


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
            this.AABBFunction(value).draw(g,0xFF0000);
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


// Used in grid pathfinding
// Instead of holding arbitrary rectangles, holds boolean whether a grid location is true or false 
export class GridQuadTree {

    private root: GridQuadNode;

    // Assumes world starts at origin, no negative values
    private width: number;

    private maxDepth: number

    private leaves: GridQuadNode[] = [];


    // Has to be a power of 2
    constructor(width: number) {
        if(!isPow2(width)) throw new Error("GridQuadTree must have width that is power of two")


        this.width = width;

        this.maxDepth = Math.log2(width);
        
        this.root = new GridQuadNode(null,0,0, width, width);

    }

    insert(x: number, y: number){
        this.put(x,y,this.root, 0)
    }

    calculateEdges(){

        for(const leaf of this.leaves){
            leaf.nset.clear();
            leaf.neighbours = [];
        }

        for(const leaf of this.leaves){
            if(leaf.walkable){
                const neighbours = this.neighbours(leaf);
                for(const nn of neighbours){
                    if(nn.walkable){
                        leaf.addEdge(nn);
                    } 
                }
            }
        }    
        // this is an expensive preproccess --> 
        // goes through all n! paths, and see which vertices are not on ANY PATH
        // then deletes these nodes because they are useless
    }

    public findPath(startx: number,starty: number, endx: number, endy: number){
        const start = this.getNode(startx,starty);
        const target = this.getNode(endx,endy);

        if(start === null || target === null) return null;
        // A STAR HERE
        // Key: node, value: the closest node that goes along the path to start
        const lastNode = new Map<GridQuadNode,GridQuadNode>();
        // Cheapest path from node to start
        const cheapestScore = new Map<GridQuadNode, number>();
        // the priority of a node, moves + heuristic
        const estimatedFinalCost = new Map<GridQuadNode, number>();

        // number is the index in the array 
        // stores lowest estimatedFinalCost to explore at top of queue
        const pq = new ModifiablePQ<GridQuadNode>((a,b) => (estimatedFinalCost.get(b) - estimatedFinalCost.get(a)));
        const inPQ = new Set<GridQuadNode>();

        cheapestScore.set(start,0);
        estimatedFinalCost.set(start,0);
        inPQ.add(start);
        pq.add(start);
    

        while(!pq.isEmpty()){
            const node = pq.popMax();
            
            if(node === target){
                // Found a path!
                const stack = new LinkedStack<GridQuadNode>();
                let nodeInPath = node;
                while(nodeInPath !== start){
                    stack.push(nodeInPath);
                    nodeInPath = lastNode.get(nodeInPath);
                }
                stack.push(start)

                const flippedPath = []
                for(const val of stack){
                    flippedPath.push(val)
                }
                return flippedPath;
            }

            inPQ.delete(node);
            for(const edge of node.neighbours){
                // Total distance from this node to start
                const n = edge[0];
                const totalDistance = cheapestScore.get(node) + edge[1];
                
                // If never seen this node, or this is a faster way here,
                if(cheapestScore.get(n) === undefined || totalDistance < cheapestScore.get(n)){
                    
                    cheapestScore.set(n,totalDistance);
                    
                    lastNode.set(n, node);

                    estimatedFinalCost.set(n,totalDistance + (1.03 * Vec2.distance(n.middle(), target.middle())));
    
                    // If this is the first time seeing this node
                    if(!inPQ.has(n)){
                        inPQ.add(n);
                        pq.add(n);
                    } else {
                        // make sure you update this nodes position in the PQ if its in there
                        pq.modify(n);
                    }
                }
            }
        }
        return null;
    }

    // returns the node at certian index
    public getNode(x: number, y: number): GridQuadNode{
        let testNode = this.root;
        
        // while not a leaf
        while(testNode.NE !== null){
            if(testNode.NE.contains(x,y)){
                testNode = testNode.NE;
            } else if(testNode.NW.contains(x,y)){
                testNode = testNode.NW;
            } else if(testNode.SE.contains(x,y)){
                testNode = testNode.SE;
            } else if(testNode.SW.contains(x,y)){
                testNode = testNode.SW;
            } else {
                // doesnt fit anywhere!
                return null;
            }
        }

        // this will only ever be returned if it doesn't fit into the root
        return testNode;
    }


    

    // Assumption --> if putting something in this tree, we are going to be splitting it until max depth which is one by one
    private put(x: number, y: number, node: GridQuadNode, depth: number){
        if(!node.contains(x,y))return;
        
        // if we are not at the last level
        if(depth != this.maxDepth){
            if(node.NE === null){
                // Now its not gaurenteed to be walkable
                node.walkable = false;
                node.NW = new GridQuadNode(node,node.minx, node.miny, (node.minx + node.maxx) / 2, (node.miny + node.maxy) / 2);
                node.NE = new GridQuadNode(node,(node.minx + node.maxx) / 2, node.miny, node.maxx, (node.miny + node.maxy) / 2);
                node.SW = new GridQuadNode(node,node.minx, (node.miny + node.maxy) / 2, (node.minx + node.maxx) / 2, node.maxy);
                node.SE = new GridQuadNode(node,(node.minx + node.maxx) / 2, (node.miny + node.maxy) / 2, node.maxx, node.maxy);
                
                this.leaves.splice(this.leaves.indexOf(node),1);

                this.leaves.push(node.NW,node.NE,node.SW,node.SE);
            } 
            
            //NW
            this.put(x,y, node.NW, depth + 1);
           
            //NE
            this.put(x,y, node.NE, depth + 1);
            
            //SW
            this.put(x,y,node.SW, depth + 1);

            // SE
            this.put(x,y, node.SE, depth + 1);
        } else {
            // this is the leaf node where this inserted wall is.
            node.walkable = false;
        }
    }


    private eastNeighbourEqual(node: GridQuadNode) {
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.NW) return parent.NE;
        if(node === parent.SW) return parent.SE;

        const eastNode = this.eastNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(eastNode === null || eastNode.NE === null) return eastNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.NE) return eastNode.NW
        else return eastNode.SW;
    }

    private eastNeighbourSmaller(equalNeighbour: GridQuadNode){
        const neighbours: GridQuadNode[] = [];

        const stack: GridQuadNode[] = [];
        if(equalNeighbour !== null) stack.push(equalNeighbour);
        while(stack.length > 0){
            const test = stack.pop();
            // if we are as deep as we can go
            if(test.NE === null) neighbours.push(test)
            else {
                stack.push(test.NW,test.SW);
            }
        }
        
        return neighbours;
    }

    private southNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.NW) return parent.SW;
        if(node === parent.NE) return parent.SE;

        const northNode = this.southNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(northNode === null || northNode.NE === null) return northNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.SW) return northNode.NW
        else return northNode.NE

        // SO far, this neigh
    }

    private northNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.SW) return parent.NW;
        if(node === parent.SE) return parent.NE;

        const northNode = this.northNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(northNode === null || northNode.NE === null) return northNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.NW) return northNode.SW
        else return northNode.SE

        // SO far, this neigh
    }

    private northNeighbourSmaller(equalNeighbour: GridQuadNode){
        const neighbours: GridQuadNode[] = [];

        const stack: GridQuadNode[] = [];
        if(equalNeighbour !== null) stack.push(equalNeighbour);
        while(stack.length > 0){
            const test = stack.pop();
            if(test.NE === null) neighbours.push(test)
            else {
                stack.push(test.SW,test.SE);
            }
        }
        
        return neighbours;
    }

    // Only one northeast neighbor max
    private northEastNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;

        if(node === parent.SW) { 
            let test = parent.NE; 

            while(test.NE !== null){
                test = test.SW;
            }
            return test;
        }
        else if(node === parent.SE){
            const eastNode = this.eastNeighbourEqual(parent);
            if(eastNode === null || eastNode.NE === null) return eastNode;
            
            let testNode = eastNode.NW;
            while(testNode.NE !== null){
                testNode = testNode.SW;
            }

            return testNode;
        } else if(node === parent.NW){
            const northNode = this.northNeighbourEqual(parent);
            if(northNode === null || northNode.NE === null) return northNode;

            //northnode at this point is the north neighbour of nodes.parent, and it has children
            
            // So this northern neighbour has siblings. Check right and then all the way to the left
            let testNode = northNode.SE;
            while(testNode.NE !== null){
                testNode = testNode.SW;
            }
            return testNode;
        } else if(node === parent.NE){
            let neNode = this.northEastNeighbourEqual(parent);
            if(neNode === null || neNode.NE === null) return neNode;

            while(neNode.NE !== null){
                neNode = neNode.SW;
            }
            return neNode;
        }
    }

    private southEastNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;

        if(node === parent.NW) { 
            let test = parent.SE; 

            while(test.NE !== null){
                test = test.NW;
            }
            return test;
        } else if(node === parent.NE){
            const eastNode = this.eastNeighbourEqual(parent);
            if(eastNode === null || eastNode.NE === null) return eastNode;
            
            let testNode = eastNode.SW;
            while(testNode.NE !== null){
                testNode = testNode.NW;
            }
            return testNode;
        } else if(node === parent.SW){
            const northNode = this.southNeighbourEqual(parent);
            if(northNode === null || northNode.NE === null) return northNode;

            //northnode at this point is the north neighbour of nodes.parent, and it has children
            
            // So this northern neighbour has siblings. Check right and then all the way to the left
            let testNode = northNode.NE;
            while(testNode.NE !== null){
                testNode = testNode.NW;
            }
            return testNode;
        } else if(node === parent.SE){
            let neNode = this.southEastNeighbourEqual(parent);
            if(neNode === null || neNode.NE === null) return neNode;

            while(neNode.NE !== null){
                neNode = neNode.NW;
            }
            return neNode;
        }
    }

    // Find all neighbours of a node 
    private neighbours(node: GridQuadNode){
        const n: GridQuadNode[] = [];
        

        // If I have northern neighbours I can just reverse it to go south
        n.push(...this.northNeighbourSmaller(this.northNeighbourEqual(node)));
        
        n.push(...this.eastNeighbourSmaller(this.eastNeighbourEqual(node)))


        const ne = this.northEastNeighbourEqual(node)
        if(ne !== null) n.push(ne)

        const se = this.southEastNeighbourEqual(node)
        if(se !== null) n.push(se)

        // go through the neighbours at the end and delete duplicates just in case;
        return n;
    }

    public draw(g: Graphics, scale: number) {
        // draw
        g.beginFill(0xFFFFFF)
        g.drawRect(0,0, this.width * scale, this.width * scale);
        g.endFill();

        for(const leaf of this.leaves){

            const node = leaf;
            const nodeCenter = node.middle().scale(scale);

            for(const edge of leaf.neighbours){
                
                const nn = edge[0];
                const nnCenter = nn.middle().scale(scale);

                drawLineBetweenPoints(g, nodeCenter, nnCenter,undefined,.2);
            }
        }

        this._draw(g, scale)
    }

    private _draw(g: Graphics, scale: number, minx = 0, miny = 0, maxx = this.width, maxy = this.width, node = this.root){
        if(node === null) return;

        g.lineStyle(4,rgb(0,0,0).hex())

        if(node.walkable === false && node.NE === null){
            g.beginFill(0x000000)
        }

        g.drawRect(minx * scale, miny * scale, maxx * scale - (minx * scale), maxy * scale - (miny * scale));
        g.endFill();

        this._draw(g, scale, minx, miny, (minx + maxx) / 2, (miny + maxy) / 2, node.NW);
        this._draw(g, scale, (minx + maxx) / 2, miny, maxx, (miny + maxy) / 2, node.NE);

        this._draw(g, scale, minx, (miny + maxy) / 2, (minx + maxx) / 2, maxy, node.SW);
        this._draw(g, scale, (minx + maxx) / 2, (miny + maxy) / 2, maxx, maxy, node.SE);

        // if we are a leaf node
        return;
        if(node.walkable === true){
            const neighbours = this.neighbours(node);
            for(const nn of neighbours){
                if(nn.walkable)
                    drawLineBetweenPoints(g, new Vec2(scale * (node.minx + node.maxx) / 2,scale *(node.miny + node.maxy) / 2), new Vec2(scale *(nn.minx + nn.maxx) / 2,scale *(nn.miny + nn.maxy) / 2));
            }
        }
    }
}

export class GridQuadNode {
    constructor(public parent: GridQuadNode,
        public minx: number,
        public miny: number,
        public maxx: number,
        public maxy: number,
    ){}


    // True if the entire square is walkable --> if have children, false because one leaf is non walkable
    walkable = true;

    NE: GridQuadNode = null;
    NW: GridQuadNode = null;
    SE: GridQuadNode = null;
    SW: GridQuadNode = null;

    contains(x: number, y: number){
        return !(x < this.minx || x >= this.maxx || y < this.miny || y >= this.maxy);
    }

    middle(){
        return new Vec2((this.minx + this.maxx) / 2, (this.miny + this.maxy) / 2);
    }

    distanceTo(node: GridQuadNode){
        return Vec2.distance(this.middle(), node.middle());
    }

    // TEMP
    nset: Set<GridQuadNode> = new Set();
    neighbours: [node: GridQuadNode, distance: number][] = null;

    addEdge(node: GridQuadNode): void {
        if(!this.nset.has(node)) {
            this.nset.add(node);
            this.neighbours.push([node, this.distanceTo(node)]);
        } 

        if(!node.nset.has(this)) {
            node.nset.add(this);
            node.neighbours.push([this, node.distanceTo(this)]);
        }
    }

    draw(g: Graphics, scale: number, width = 3, color = 0x000000){
        g.lineStyle(width, color)
        g.drawRect(scale * this.minx, scale * this.miny, scale *  (this.maxx - this.minx), scale * (this.maxy - this.miny))
    }

}

export class LiveGridQuadTree {

    private root: GridQuadNode;

    // Assumes world starts at origin, no negative values
    private width: number;

    private maxDepth: number

    private leaves: GridQuadNode[] = [];


    // Has to be a power of 2
    constructor(width: number) {
        if(!isPow2(width)) throw new Error("GridQuadTree must have width that is power of two")

        this.width = width;

        this.maxDepth = Math.log2(width);
        
        this.root = new GridQuadNode(null,0,0, width, width);

    }

    insert(x: number, y: number){
        this.put(x,y,this.root, 0)
    }

    calculateEdges(){

        for(const leaf of this.leaves){
            leaf.nset.clear();
            leaf.neighbours = [];
        }

        for(const leaf of this.leaves){
            if(leaf.walkable){
                const neighbours = this.neighbours(leaf);
                for(const nn of neighbours){
                    if(nn.walkable){
                        leaf.addEdge(nn);
                    } 
                }
            }
        }    
        // this is an expensive preproccess --> 
        // goes through all n! paths, and see which vertices are not on ANY PATH
        // then deletes these nodes because they are useless
    }

    private lastNode: Map<GridQuadNode,GridQuadNode>;
    private cheapestScore: Map<GridQuadNode, number>;
    private estimatedFinalCost: Map<GridQuadNode, number>
    private pq: ModifiablePQ<GridQuadNode>;
    private inPQ: Set<GridQuadNode>;


    private exploredConnections: [GridQuadNode, GridQuadNode][] = [];

    private solved = false;
    private solvable = true;

    private start: GridQuadNode;
    private target: GridQuadNode;
    private finalPath: GridQuadNode[] = null;
    private iterations = 0;
        
    public startPath(startx: number,starty: number, endx: number, endy: number){

        this.calculateEdges();

        this.start = this.getNode(startx,starty);
        this.target = this.getNode(endx,endy);

        if(this.start === null || this.target === null) return null;
        // A STAR HERE
        // Key: node, value: the closest node that goes along the path to start
        this.lastNode = new Map<GridQuadNode,GridQuadNode>();
        // Cheapest path from node to start
        this.cheapestScore = new Map<GridQuadNode, number>();
        // the priority of a node, moves + heuristic
        this.estimatedFinalCost = new Map<GridQuadNode, number>();

        // number is the index in the array 
        // stores lowest estimatedFinalCost to explore at top of queue
        this.pq = new ModifiablePQ<GridQuadNode>((a,b) => (this.estimatedFinalCost.get(b) - this.estimatedFinalCost.get(a)));
        this.inPQ = new Set<GridQuadNode>();

        this.exploredConnections = [];

        this.cheapestScore.set(this.start,0);
        this.estimatedFinalCost.set(this.start,0);
        this.inPQ.add(this.start);
        this.pq.add(this.start);
    
        this.iterations = 0;
        this.solved = false;
        this.solvable = (new GridQuadTree(this.width).findPath(startx, starty,endx, endy) !== null)
    }

    private heuristicScale = 1;
    // returns true if done
    public stepPath(){
        if(!this.solvable) return true; 
        if(this.solved) return true;

        if(!this.pq.isEmpty()){
            this.iterations++
            const node = this.pq.popMax();
            
            if(node === this.target){
                // Found a path!
                console.log(this.iterations)
                const stack = new LinkedStack<GridQuadNode>();
                let nodeInPath = node;
                while(nodeInPath !== this.start){
                    stack.push(nodeInPath);
                    nodeInPath = this.lastNode.get(nodeInPath);
                }
                stack.push(this.start)

                const flippedPath = []
                for(const val of stack){
                    flippedPath.push(val)
                }
                this.finalPath = flippedPath;
                this.solved = true;
            }

            this.inPQ.delete(node);
            for(const edge of node.neighbours){
                this.exploredConnections.push([node, edge[0]])
                // Total distance from this node to start
                const n = edge[0];
                const totalDistance = this.cheapestScore.get(node) + edge[1];
                
                // If never seen this node, or this is a faster way here,
                if(this.cheapestScore.get(n) === undefined || totalDistance < this.cheapestScore.get(n)){
                    
                    this.cheapestScore.set(n,totalDistance);
                    
                    this.lastNode.set(n, node);

                    this.estimatedFinalCost.set(n,totalDistance + (this.heuristicScale * Vec2.distance(n.middle(), this.target.middle())));
    
                    // If this is the first time seeing this node
                    if(!this.inPQ.has(n)){
                        this.inPQ.add(n);
                        this.pq.add(n);
                    } else {
                        // make sure you update this nodes position in the PQ if its in there
                        this.pq.modify(n);
                    }
                }
            }
        }

        return false;
    }

    // returns the node at certian index
    public getNode(x: number, y: number): GridQuadNode{
        let testNode = this.root;
        
        // while not a leaf
        while(testNode.NE !== null){
            if(testNode.NE.contains(x,y)){
                testNode = testNode.NE;
            } else if(testNode.NW.contains(x,y)){
                testNode = testNode.NW;
            } else if(testNode.SE.contains(x,y)){
                testNode = testNode.SE;
            } else if(testNode.SW.contains(x,y)){
                testNode = testNode.SW;
            } else {
                // doesnt fit anywhere!
                return null;
            }
        }

        // this will only ever be returned if it doesn't fit into the root
        return testNode;
    }

    // Assumption --> if putting something in this tree, we are going to be splitting it until max depth which is one by one
    private put(x: number, y: number, node: GridQuadNode, depth: number){
        if(!node.contains(x,y))return;
        
        // if we are not at the last level
        if(depth != this.maxDepth){
            if(node.NE === null){
                // Now its not gaurenteed to be walkable
                node.walkable = false;
                node.NW = new GridQuadNode(node,node.minx, node.miny, (node.minx + node.maxx) / 2, (node.miny + node.maxy) / 2);
                node.NE = new GridQuadNode(node,(node.minx + node.maxx) / 2, node.miny, node.maxx, (node.miny + node.maxy) / 2);
                node.SW = new GridQuadNode(node,node.minx, (node.miny + node.maxy) / 2, (node.minx + node.maxx) / 2, node.maxy);
                node.SE = new GridQuadNode(node,(node.minx + node.maxx) / 2, (node.miny + node.maxy) / 2, node.maxx, node.maxy);
                
                this.leaves.splice(this.leaves.indexOf(node),1);

                this.leaves.push(node.NW,node.NE,node.SW,node.SE);
            } 
            
            //NW
            this.put(x,y, node.NW, depth + 1);
           
            //NE
            this.put(x,y, node.NE, depth + 1);
            
            //SW
            this.put(x,y,node.SW, depth + 1);

            // SE
            this.put(x,y, node.SE, depth + 1);
        } else {
            // this is the leaf node where this inserted wall is.
            node.walkable = false;
        }
    }


    private eastNeighbourEqual(node: GridQuadNode) {
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.NW) return parent.NE;
        if(node === parent.SW) return parent.SE;

        const eastNode = this.eastNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(eastNode === null || eastNode.NE === null) return eastNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.NE) return eastNode.NW
        else return eastNode.SW;
    }

    private eastNeighbourSmaller(equalNeighbour: GridQuadNode){
        const neighbours: GridQuadNode[] = [];

        const stack: GridQuadNode[] = [];
        if(equalNeighbour !== null) stack.push(equalNeighbour);
        while(stack.length > 0){
            const test = stack.pop();
            // if we are as deep as we can go
            if(test.NE === null) neighbours.push(test)
            else {
                stack.push(test.NW,test.SW);
            }
        }
        
        return neighbours;
    }

    private southNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.NW) return parent.SW;
        if(node === parent.NE) return parent.SE;

        const northNode = this.southNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(northNode === null || northNode.NE === null) return northNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.SW) return northNode.NW
        else return northNode.NE

        // SO far, this neigh
    }

    private northNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;
        if(node === parent.SW) return parent.NW;
        if(node === parent.SE) return parent.NE;

        const northNode = this.northNeighbourEqual(parent);
        // if no northern nodes, then no northern sibling. If it has no children, it is the nothern sibling
        if(northNode === null || northNode.NE === null) return northNode;
        
        // Check whether or not it is the right or left southern node that is northern neighbour
        if(node === parent.NW) return northNode.SW
        else return northNode.SE

        // SO far, this neigh
    }

    private northNeighbourSmaller(equalNeighbour: GridQuadNode){
        const neighbours: GridQuadNode[] = [];

        const stack: GridQuadNode[] = [];
        if(equalNeighbour !== null) stack.push(equalNeighbour);
        while(stack.length > 0){
            const test = stack.pop();
            if(test.NE === null) neighbours.push(test)
            else {
                stack.push(test.SW,test.SE);
            }
        }
        
        return neighbours;
    }

    // Only one northeast neighbor max
    private northEastNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;

        if(node === parent.SW) { 
            let test = parent.NE; 

            while(test.NE !== null){
                test = test.SW;
            }
            return test;
        }
        else if(node === parent.SE){
            const eastNode = this.eastNeighbourEqual(parent);
            if(eastNode === null || eastNode.NE === null) return eastNode;
            
            let testNode = eastNode.NW;
            while(testNode.NE !== null){
                testNode = testNode.SW;
            }

            return testNode;
        } else if(node === parent.NW){
            const northNode = this.northNeighbourEqual(parent);
            if(northNode === null || northNode.NE === null) return northNode;

            //northnode at this point is the north neighbour of nodes.parent, and it has children
            
            // So this northern neighbour has siblings. Check right and then all the way to the left
            let testNode = northNode.SE;
            while(testNode.NE !== null){
                testNode = testNode.SW;
            }
            return testNode;
        } else if(node === parent.NE){
            let neNode = this.northEastNeighbourEqual(parent);
            if(neNode === null || neNode.NE === null) return neNode;

            while(neNode.NE !== null){
                neNode = neNode.SW;
            }
            return neNode;
        }
    }

    private southEastNeighbourEqual(node: GridQuadNode){
        // North neighbour
        const parent = node.parent;
        // root doesn't have neighbours
        if(parent === null) return null;

        if(node === parent.NW) { 
            let test = parent.SE; 

            while(test.NE !== null){
                test = test.NW;
            }
            return test;
        } else if(node === parent.NE){
            const eastNode = this.eastNeighbourEqual(parent);
            if(eastNode === null || eastNode.NE === null) return eastNode;
            
            let testNode = eastNode.SW;
            while(testNode.NE !== null){
                testNode = testNode.NW;
            }
            return testNode;
        } else if(node === parent.SW){
            const northNode = this.southNeighbourEqual(parent);
            if(northNode === null || northNode.NE === null) return northNode;

            //northnode at this point is the north neighbour of nodes.parent, and it has children
            
            // So this northern neighbour has siblings. Check right and then all the way to the left
            let testNode = northNode.NE;
            while(testNode.NE !== null){
                testNode = testNode.NW;
            }
            return testNode;
        } else if(node === parent.SE){
            let neNode = this.southEastNeighbourEqual(parent);
            if(neNode === null || neNode.NE === null) return neNode;

            while(neNode.NE !== null){
                neNode = neNode.NW;
            }
            return neNode;
        }
    }

    // Find all neighbours of a node 
    private neighbours(node: GridQuadNode){
        const n: GridQuadNode[] = [];
        

        // If I have northern neighbours I can just reverse it to go south
        n.push(...this.northNeighbourSmaller(this.northNeighbourEqual(node)));
        
        n.push(...this.eastNeighbourSmaller(this.eastNeighbourEqual(node)))


        const ne = this.northEastNeighbourEqual(node)
        if(ne !== null) n.push(ne)

        const se = this.southEastNeighbourEqual(node)
        if(se !== null) n.push(se)

        // go through the neighbours at the end and delete duplicates just in case;
        return n;
    }

    public draw(g: Graphics, scale: number) {
        // draw
        g.beginFill(0xFFFFFF)
        g.drawRect(0,0, this.width * scale, this.width * scale);
        g.endFill();

        g.alpha = .05
        // Drawing connections
        for(const leaf of this.leaves){

            const node = leaf;
            const nodeCenter = node.middle().scale(scale);

            for(const edge of leaf.neighbours){
                
                const nn = edge[0];
                const nnCenter = nn.middle().scale(scale);

                drawLineBetweenPoints(g, nodeCenter, nnCenter,undefined,.2);
            }
        }

        // drawing the rectangles
        g.alpha = .2;
        this._draw(g, scale)
        g.alpha = .78;

        if(this.start){
            this.start.draw(g,scale,21,0xff1212)
            this.target.draw(g,scale,21,0xff1212)
        }
        // draw explored nodes
        for(const edge of this.exploredConnections){
            drawLineBetweenPoints(g, edge[0].middle().scale(scale), edge[1].middle().scale(scale),0x4248f, 1, 7);
        }
        g.alpha = 1;
        // FINNISHED PATH
        if(this.finalPath !== null){
            for(let i = 0; i < this.finalPath.length - 1; i++){

                const node = this.finalPath[i];
                const nn = this.finalPath[i + 1];

                drawLineBetweenPoints(g, node.middle().scale(scale), nn.middle().scale(scale),0xdea22a, 1, 30);
            }
        }
    }

    private _draw(g: Graphics, scale: number, minx = 0, miny = 0, maxx = this.width, maxy = this.width, node = this.root){
        if(node === null) return;

        g.lineStyle(4,rgb(0,0,0).hex())

        if(node.walkable === false && node.NE === null){
            g.beginFill(0x000000)
        }

        g.drawRect(minx * scale, miny * scale, maxx * scale - (minx * scale), maxy * scale - (miny * scale));
        g.endFill();

        this._draw(g, scale, minx, miny, (minx + maxx) / 2, (miny + maxy) / 2, node.NW);
        this._draw(g, scale, (minx + maxx) / 2, miny, maxx, (miny + maxy) / 2, node.NE);

        this._draw(g, scale, minx, (miny + maxy) / 2, (minx + maxx) / 2, maxy, node.SW);
        this._draw(g, scale, (minx + maxx) / 2, (miny + maxy) / 2, maxx, maxy, node.SE);
    }
}







