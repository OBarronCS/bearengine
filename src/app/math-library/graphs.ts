
import { Graphics, Text } from "pixi.js";
import { blend, rgb } from "./color";
import { abs, floor, min } from "./miscmath";
import { ModifiablePQ, PQ } from "./priorityqueue";
import { LinkedQueue } from "./queue";
import { LinkedStack, LightLinkedBag } from "./stack";
import { distanceSquared } from "./shapes/vec2";


// TODO: 
//  make distance between nodes be a factor.
//  Implement a more generic version
//  Reimplemented ASTAR
//  Optimized version for 2D grids

// Change it into the graph class
// add Edge class to allow weighted edges --> has Node, distance, next
// while require more managament that we need the graph class for


// Allows for connected component tests aswell as paths between nodes
// no weights implemented
class GraphNode<T> {
    // The thing that uniquely describes this node
    // could be a string name, a [x,y] coordinate,
    identity: T;
    connected: LightLinkedBag<GraphNode<T>>;

    constructor(identity: T) {
        this.identity = identity;
        this.connected = new LightLinkedBag<GraphNode<T>>();
    }

    addEdge(node: GraphNode<T>): void {
        if(!this.connected.contains(node)) this.connected.push(node);
        if(!node.connected.contains(this)) node.connected.push(this);
    }

    // Returns a path to the given node, including self and target, else null
    breadthFirstSearch(targetNode: GraphNode<T>): GraphNode<T>[]{
        const queue = new LinkedQueue<PathNode<T>>();

        const discovered = new Set<GraphNode<T>>();
        discovered.add(this);
        queue.enqueue(new PathNode(0,this,null));

        while(!queue.isEmpty()){
            const pathNode = queue.dequeue();
            if(pathNode.node === targetNode){
                // We found a path!
                const finalPath: GraphNode<T>[] = []
                for(let x = pathNode; x != null; x = x.parent){
                    finalPath.push(x.node);
                }
                return finalPath;
            }

            for(const neighbour of pathNode.node.connected){
                if(!discovered.has(neighbour)){
                    discovered.add(neighbour);
                    queue.enqueue(new PathNode(pathNode.moves + 1, neighbour, pathNode));
                }
            }
        }

        return null;
    }


    // Exactly the same code as breadth first, expect uses a stack and not a queue!
    depthFirstSearch(targetNode: GraphNode<T>){
        const stack = new LinkedStack<PathNode<T>>();

        const discovered = new Set<GraphNode<T>>();
        discovered.add(this);
        
        stack.push(new PathNode(0,this,null));

        while(!stack.isEmpty()){
            const pathNode = stack.pop();
            if(pathNode.node === targetNode){
                // We found a path!
                const finalPath: GraphNode<T>[] = []
                for(let x = pathNode; x != null; x = x.parent){
                    finalPath.push(x.node);
                }
                return finalPath;
            }

            for(const neighbour of pathNode.node.connected){
                if(!discovered.has(neighbour)){
                    discovered.add(neighbour);
                    stack.push(new PathNode(pathNode.moves + 1, neighbour, pathNode));
                }
            }
        }

        return null;
    }

    toString(): string {
        return this.identity.toString();
    }
}

// A node in a current testing path
class PathNode<T> {
    // the distance moved so far!
    moves: number;
    node: GraphNode<T>;
    parent: PathNode<T>;

    constructor(moves: number, node: GraphNode<T>, parent: PathNode<T>){
        this.moves = moves;
        this.node = node;
        this.parent = parent;
    }
}

// Convert graph nodes to be handled by this class --> easier handling of edges
export class Graph<T> {
    constructor(){}

    createNode(identity: T): void {
        const node = new GraphNode<T>(identity);
    }
}

// This class allows you to create nodes that can be reference by numbers or strings
// Essentially a convenience class.
type primitiveTypes =  number|string
export class NamedGraph<P extends primitiveTypes> {
    private nodes = new Set<P>();
    private edges = new Map<P, LightLinkedBag<P>>();

    addNode(name: P){
        this.nodes.add(name);
        this.edges.set(name,new LightLinkedBag<P>())
    }

    addEdge(node1: P, node2: P){
        const neighbors1 = this.edges.get(node1);
        if(!neighbors1.contains(node2)){
            neighbors1.push(node2);
        }
        const neighbors2 = this.edges.get(node2);
        if(!neighbors2.contains(node1)){
            neighbors2.push(node1);
        }
    }

    // Returns a path to the given node, including self and target, else null
    breadthFirstSearch(start: P, target: P): Iterable<P>{
        const queue = new LinkedQueue<NamedPathNode<P>>();

        const discovered = new Set<P>();
        discovered.add(start);
        queue.enqueue(new NamedPathNode(0,start,null));

        while(!queue.isEmpty()){
            const pathNode = queue.dequeue();
            if(pathNode.node === target){
                // We found a path!
                const finalPath = new LinkedStack<P>();
                for(let x = pathNode; x != null; x = x.parent){
                    finalPath.push(x.node);
                }
                return finalPath;
            }

            for(const neighbour of this.edges.get(pathNode.node)){
                if(!discovered.has(neighbour)){
                    discovered.add(neighbour);
                    queue.enqueue(new NamedPathNode(pathNode.moves + 1, neighbour, pathNode));
                }
            }
        }

        return null;
    }


    // Exactly the same code as breadth first, expect uses a stack and not a queue!
    depthFirstSearch(start: P, target: P): Iterable<P>{
        const stack = new LinkedStack<NamedPathNode<P>>();

        const discovered = new Set<P>();
        discovered.add(start);
        
        stack.push(new NamedPathNode(0,start,null));

        while(!stack.isEmpty()){
            const pathNode = stack.pop();
            if(pathNode.node === target){
                // We found a path!
                const finalPath = new LinkedStack<P>();
                for(let x = pathNode; x != null; x = x.parent){
                    finalPath.push(x.node);
                }
                return finalPath;
            }

            for(const neighbour of this.edges.get(pathNode.node)){
                if(!discovered.has(neighbour)){
                    discovered.add(neighbour);
                    stack.push(new NamedPathNode(pathNode.moves + 1, neighbour, pathNode));
                }
            }
        }

        return null;
    }
}

// A node in a current testing path
class NamedPathNode<P extends primitiveTypes> {
    // the distance moved so far!
    moves: number;
    node: P;
    parent: NamedPathNode<P>;

    constructor(moves: number, node: P, parent: NamedPathNode<P>){
        this.moves = moves;
        this.node = node;
        this.parent = parent;
    }
}

// TODO: used for pathfinding in grids, common in games.
export class GridGraph {
    private grid: boolean[] = [];

    private width: number;
    private height: number;
    
    constructor(w: number, h: number){
        this.width = w;
        this.height = h;

        // 1 d so its easier to identify each value
        this.grid.length = h * w;
        this.grid.fill(true);
    }

    // converts from two space to 1d index
    two2one(x: number, y: number){
        return (y * this.width) + x;
    }

    // converts from 1d index to 2d space
    one2two(index: number): [ number, number] {
        const y = Math.floor(index / this.width)
        return [index - (y * this.width), y];
    }

    /** Makes it so you cannot walk at a position */
    blockcell(x: number, y: number) {
        this.grid[this.two2one(x,y)] = false;
    }


    astar(xstart: number, ystart: number, xtarget: number, ytarget: number){
        const start = this.two2one(xstart, ystart);
        const target = this.two2one(xtarget, ytarget);

        // Key: node, value: the closest node that goes along the path to start
        const lastNode = new Map<number,number>();
        // Cheapest path from node to start
        const cheapestScore = new Map<number, number>();
        // the priority of a node, moves + heuristic
        const estimatedFinalCost = new Map<number, number>();

        // number is the index in the array 
        // stores lowest estimatedFinalCost to explore at top of queue
        const pq = new ModifiablePQ<number>((a,b) => (estimatedFinalCost.get(b) - estimatedFinalCost.get(a)));
        const inPQ = new Set<number>();

        cheapestScore.set(start,0);
        estimatedFinalCost.set(start,0);
        inPQ.add(start);
        pq.add(start);
    

        while(!pq.isEmpty()){
            const node = pq.popMax();
            
            if(node === target){
                // Found a path!
                const raw:number[] = []
                const stack = new LinkedStack<[number, number]>();
                let nodeInPath = node;
                while(nodeInPath !== start){
                    raw.push(nodeInPath)
                    stack.push(this.one2two(nodeInPath));
                    nodeInPath = lastNode.get(nodeInPath);
                }
                stack.push(this.one2two(start))
                raw.push(start);

                return stack;
            }

            inPQ.delete(node);
            for(const neighbour of this.neighbours(node)){
                // Total distance from this node to start
                const totalDistance = cheapestScore.get(node) + this.euclidean(neighbour,node);
                
                // If never seen this node, or this is a faster way here,
                if(cheapestScore.get(neighbour) === undefined || totalDistance < cheapestScore.get(neighbour)){
                    
                    cheapestScore.set(neighbour,totalDistance);
                    
                    lastNode.set(neighbour, node);

                    estimatedFinalCost.set(neighbour,totalDistance + this.heuristic(neighbour, target));
    
                    // If this is the first time seeing this node
                    if(!inPQ.has(neighbour)){
                        inPQ.add(neighbour);
                        pq.add(neighbour);
                    } else {
                        // make sure you update this nodes position in the PQ if its in there
                        pq.modify(neighbour);
                    }
                }
            }
        }
        return null;
    }

    euclidean(first: number, second: number){
        const [xfirst,yfirst] = this.one2two(first);
        const [xsecond,ysecond] = this.one2two(second);
        return Math.hypot(xfirst - xsecond, yfirst - ysecond);
    }
    
    heuristic(first: number, second: number){
        const [xfirst,yfirst] = this.one2two(first);
        const [xsecond,ysecond] = this.one2two(second);
        const dx = abs(xfirst - xsecond);
        const dy = abs(yfirst - ysecond);
        return (dx + dy) + (Math.SQRT2-1) * min(dx,dy);
    }

    neighbours(index: number): number[] {
        const [x,y] = this.one2two(index);
        const n: number[] = [];
        for(let i = -1; i <= 1; i++){
            for(let j = -1; j <= 1; j++){
                if(i === 0 && j === 0) continue;

                if(x + i >= 0 && x + i < this.width){
                    if(y + j >= 0 && y + j < this.height){
                        const nIndex = index + i + (j * this.width);
                        if(this.grid[nIndex] === true){
                            n.push(nIndex);
                        }
                    }
                }
            }
        }
        return n;
    }

    consoleLogPath(indices: number[]){
        let str = ""
        for(let i = 0; i < this.height; i++){
            for(let j = 0; j < this.width; j++){
                const index = this.two2one(j,i);
                if(indices.includes(index)){
                    str += "P";
                } else if(this.grid[index] === true){
                    str += "#";
                } else {
                    str += "O";
                }
            }
            str += "\n";
        }
        return str;
    }

    toString(): string {
        let str = ""
        for(let i = 0; i < this.height; i++){
            for(let j = 0; j < this.width; j++){
                const index = this.two2one(j,i);
                if(this.grid[index] === true){
                    str += "#";
                } else {
                    str += "O";
                }
            }
            str += "\n";
        }
        return str;
    }
    
}


// I used this to debug the gridgraph,
// Allows you to slowly go through the ASTAR algorithm and draw it live 
export class LiveGridGraph {
    private grid: boolean[] = [];

    private width: number;
    private height: number;


    constructor(w: number, h: number){
        this.width = w;
        this.height = h;

        // 1 d so its easier to identify each value
        this.grid.length = h * w;
        this.grid.fill(true);
    }

    // converts from two space to 1d index
    two2one(x: number, y: number){
        return (y * this.width) + x;
    }

    // converts from 1d index to 2d space
    one2two(index: number): [ number, number] {
        const y = Math.floor(index / this.width)
        return [index - (y * this.width), y];
    }

    /** Makes it so you cannot walk at a position */
    blockcell(x: number, y: number) {
        this.grid[this.two2one(x,y)] = false;
    }

    private lastNode: Map<number,number>;
    private cheapestScore: Map<number,number>;
    private estimatedFinalCost: Map<number,number>;
    private pq: ModifiablePQ<number>;
    private inPQ: Set<number>;

    private start: number;
    private target: number;
    // null if not done yet
    private finalPath: number[];
    private solved = false;
    private solvable = true;

    start_astar(xstart: number, ystart: number, xtarget: number, ytarget: number){
        this.start = this.two2one(xstart, ystart);
        this.target = this.two2one(xtarget, ytarget);

        // Key: node, value: the closest node that goes along the path to start
        this.lastNode = new Map<number,number>();
        // Cheapest path from node to start
        this.cheapestScore = new Map<number, number>();
        // the priority of a node, moves + heuristic
        this.estimatedFinalCost = new Map<number, number>();

        // number is the index in the array 
        // stores lowest estimatedFinalCost to explore at top of queue
        this.pq = new ModifiablePQ<number>((a,b) => (this.estimatedFinalCost.get(b) - this.estimatedFinalCost.get(a)));
        this.inPQ = new Set<number>();

        this.cheapestScore.set(this.start,0);
        this.estimatedFinalCost.set(this.start,0);
        this.inPQ.add(this.start);
        this.pq.add(this.start);
        this.finalPath = null;
        this.solved = false;
        this.solvable = true;

        const test = new GridGraph(this.width, this.height);
        test["grid"] = this.grid.slice(0)
        this.solvable = (test.astar(xstart,ystart,xtarget,ytarget) !== null);
    }

    // true if done!
    step_astar(){
        if(!this.solvable) return true;
        if(this.solved) return true;

        if(!this.pq.isEmpty()){
            const node = this.pq.popMax();
            
            if(node === this.target){
                // Found a path!
                const raw:number[] = []
                const stack = new LinkedStack<[number, number]>();
                let nodeInPath = node;
                while(nodeInPath !== this.start){
                    raw.push(nodeInPath)
                    stack.push(this.one2two(nodeInPath));
                    nodeInPath = this.lastNode.get(nodeInPath);
                }
                stack.push(this.one2two(this.start))
                raw.push(this.start);

                this.finalPath = raw;

                this.solved = true;
                return true;
            }
            this.inPQ.delete(node);
            for(const neighbour of this.neighbours(node)){
                // Total distance from this node to start
                const totalDistance = this.cheapestScore.get(node) + this.euclidean(neighbour,node);
                
                // If never seen this node, or this is a faster way here,
                if(this.cheapestScore.get(neighbour) === undefined || totalDistance < this.cheapestScore.get(neighbour)){
                    
                    this.cheapestScore.set(neighbour,totalDistance);
                    
                    this.lastNode.set(neighbour, node);

                    this.estimatedFinalCost.set(neighbour,totalDistance + this.heuristic(neighbour, this.target));
  
                    // If this is the first time seeing this node
                    if(!this.inPQ.has(neighbour)){
                        this.inPQ.add(neighbour);
                        this.pq.add(neighbour);
                    } else {
                        // make sure you update this nodes position in the PQ if its in there
                        this.pq.modify(neighbour);
                    }
                }
            }
        } 
            
        return false;
        
    }

    euclidean(first: number, second: number){
        const [xfirst,yfirst] = this.one2two(first);
        const [xsecond,ysecond] = this.one2two(second);
        return Math.hypot(xfirst - xsecond, yfirst - ysecond);
    }
    
    heuristic(first: number, second: number){
        const [xfirst,yfirst] = this.one2two(first);
        const [xsecond,ysecond] = this.one2two(second);
        const dx = abs(xfirst - xsecond);
        const dy = abs(yfirst - ysecond);
        return (dx + dy) + (Math.SQRT2-1) * min(dx,dy);
    }

    neighbours(index: number): number[] {
        const [x,y] = this.one2two(index);
        const n: number[] = [];
        for(let i = -1; i <= 1; i++){
            for(let j = -1; j <= 1; j++){
                if(i === 0 && j === 0) continue;

                if(x + i >= 0 && x + i < this.width){
                    if(y + j >= 0 && y + j < this.height){
                        const nIndex = index + i + (j * this.width);
                        if(this.grid[nIndex] === true){
                            n.push(nIndex);
                        }
                    }
                }
            }
        }
        return n;
    }

    consoleLogPath(indices: number[]){
        let str = ""
        for(let i = 0; i < this.height; i++){
            for(let j = 0; j < this.width; j++){
                const index = this.two2one(j,i);
                if(indices.includes(index)){
                    str += "P";
                } else if(this.grid[index] === true){
                    str += "#";
                } else {
                    str += "O";
                }
            }
            str += "\n";
        }
        return str;
    }

    toString(): string {
        let str = ""
        for(let i = 0; i < this.height; i++){
            for(let j = 0; j < this.width; j++){
                const index = this.two2one(j,i);
                if(this.grid[index] === true){
                    str += "#";
                } else {
                    str += "O";
                }
            }
            str += "\n";
        }
        return str;
    }

    /**
    private lastNode: Map<number,number>;
    private cheapestScore: Map<number,number>;
    private estimatedFinalCost: Map<number,number>;
    private pq: PQ<number>;
    private inPQ: Set<number>;
     */
    draw(g: Graphics, scale = 1){
        g.removeChildren();

        const [x1,y1] = this.one2two(this.start);
        const [x2,y2] = this.one2two(this.target);

        const maxVal = Math.hypot(x1 - x2,y1 - y2);
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){
                const index = this.two2one(i,j);
                g.endFill()
                if(this.grid[index] === false){
                    g.lineStyle(3,0xffffff);
                } else {
                    g.lineStyle(3,0x000000);
                    g.beginFill(0x46484d);
                }

                if(this.estimatedFinalCost.has(index)){
                    const val = this.estimatedFinalCost.get(index);
                    const percent = val / maxVal;
                    g.lineStyle(3,0xff0000);
                    g.beginFill(blend(rgb(25,255,0),rgb(255,0,0),percent).value());
                }

                //  else if(this.inPQ.has(index)){
                //     g.lineStyle(3,0xff0000);
                //     g.beginFill(0xff0000, .1);
                // }

                if(this.finalPath !== null){
                    if(this.finalPath.includes(index)){
                        g.lineStyle(3,0xe8913f);
                        g.beginFill(0xe8913f);
                    }
                }

               

                g.drawRect(i * scale,j*scale,scale, scale)

                // const cost = this.estimatedFinalCost.get(index);
                // if(cost !== undefined){
                //     const text = new Text(cost.toFixed(1) + "",{
                //         fontSize: 13
                //     });
                //     text.x = i * scale;
                //     text.y = j * scale;
                    
                //     g.addChild(text);
                // }
            }
        }

    }
}




