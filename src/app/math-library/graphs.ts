
import { Graphics } from "pixi.js";
import { LinkedQueue } from "./queue";
import { LinkedStack, LightLinkedBag } from "./stack";


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


// TODO: used for pathfinding in grids, common in games.
export class GridGraph {

    // true if can walk, false else
    private grid: boolean[][] = [];

    constructor(){}

    draw(g: Graphics){
        
    }
}



