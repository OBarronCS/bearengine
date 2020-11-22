
// use Rect class for the bounding boxes

import { Graphics } from "pixi.js";
import { GraphNode } from "./graphs";
import { niceColor } from "./miscmath";
import { PQ } from "./priorityqueue";
import { LinkedQueue } from "./queue";
import { Ellipse } from "./shapes/ellipse";
import { Rect } from "./shapes/rectangle";
import { LinkedStack } from "./stack";


// Explained in a 2019 GDC talk, 
// https://box2d.org/files/ErinCatto_DynamicBVH_GDC2019.pdf

// TODO, make it actually dynamic, with moving bounding boxes and such
// make the AABB's a bit enlarged, so that you don't need to constantly reinserterd
// so their is a tight aabb, the actual object, and a larger aabb that holds it
// only update it if aabb is larger
// also, make compenstaitons for velocity, so if moving a certian direction, make it larger in that respect

// go to page 73 for balancing




class Node {
        
    public parent: Node = null;
    public left: Node = null;
    public right: Node = null;

    constructor(
        public object: Ellipse,
        public aabb: Rect,
        public isLeaf: boolean,
    ) {}
}


export class DynamicAABBTree {

    private root: Node = null;

    // insertion
    // for now, obj is a referenace to object, ellipse for testing.
    insert(obj: Ellipse){
        const aabb = obj.getAABB();

        const leaf = new Node(obj, aabb, true)

        if(this.root === null) {
            this.root = leaf;
            return;
        }

        // Find best sibling to be surrounded by an AABB with
        let sibling = this.bestSibling(leaf);
        
        const oldParent = sibling.parent;

        // creates new internal node
        const newParent = new Node(null,null, false);
        newParent.parent = oldParent;
        newParent.aabb = aabb.merge(sibling.aabb);

        // if sibling is not root
        if(oldParent !== null){
            if(oldParent.left === sibling){
                oldParent.left = newParent;
            } else {
                oldParent.right = newParent;
            }

            // its arbitrary which one we pick, i
            newParent.left = sibling;
            newParent.right = leaf;

            sibling.parent = newParent;
            leaf.parent = newParent;
        } else {
            // If the root is the best
            newParent.left = sibling;
            newParent.right = leaf;

            sibling.parent = newParent;
            leaf.parent = newParent;

            this.root = newParent;
        }

        // Walk back, refitting aabb's
        let currentNode = newParent.parent;
        while(currentNode !== null){
            const left = currentNode.left;
            const right = currentNode.right;

            currentNode.aabb = left.aabb.merge(right.aabb);
            currentNode = currentNode.parent;
        }
    }


    bestSibling(node: Node): Node {
        // this is an efficient method that avoids looking at ALL of the possible siblings
        interface Candidate {
            node: Node;
            cost: number;
        }

        const nodeSA = node.aabb.area()
        
        // explore best candidates first
        const pq = new PQ<Candidate>((a,b) => a.cost - b.cost);
        
        const rootCost = this.insertCost(this.root,node)

        pq.add({ node: this.root, cost: rootCost })

        let bestNode = this.root;
        let bestCost = rootCost

        while(!pq.isEmpty()){
            // test AABB is node.aabb merge with this, 
            // cost of insertion 
            const candidate = pq.popMax();
            const possibleSibling = candidate.node;
    
            const currentCost = candidate.cost;

            if(currentCost < bestCost){
                bestCost = currentCost;
                bestNode = possibleSibling;
            }
            
            // should I add the children? Let's check

            // all non leaves have have both children
            if(!possibleSibling.isLeaf){
                // if the lower bound is smaller than best, it might be here!
                if(nodeSA + this.inheritedCost(possibleSibling.left,node) < bestCost){
                    pq.add({ node: possibleSibling.left, cost: this.insertCost(possibleSibling.left, node) });
                    pq.add({ node: possibleSibling.right, cost: this.insertCost(possibleSibling.right, node) })
                }
            }

        }

        return bestNode;
    }


    private inheritedCost(node: Node, newSibling: Node){
        let total = 0;

        // Node and sibling are now encapsulated by this AABB (temp)
        const newParentAABB = node.aabb.merge(newSibling.aabb);

        // goes up the tree, adding the delta of new retrofitted rectangle SA's
        let lastNode = node;
        let lastNodeAABB = newParentAABB;
        let currentNode = node.parent;

        while(currentNode !== null){
            const oldSA = currentNode.aabb.area();
    
            if(currentNode.left === lastNode){
                lastNodeAABB = currentNode.right.aabb.merge(lastNodeAABB);
                total += lastNodeAABB.area() - oldSA;
            } else {
                lastNodeAABB = currentNode.left.aabb.merge(lastNodeAABB);
                total += lastNodeAABB.area() - oldSA;
            }

            lastNode = currentNode;
            currentNode = currentNode.parent;
        }

        return total;
    }

    /// these two might become new siblings, test new cost
    // node is in the tree, newSibling is not
    private insertCost(node: Node, newSibling: Node){
        const newParentAABB = node.aabb.merge(newSibling.aabb);
        return newParentAABB.area() + this.inheritedCost(node, newSibling);
    }

    // converting to array would make this faster;
    nodeCost(node: Node){
        
        const stack = new LinkedStack<Node>();
        stack.push(node);

        let cost = 0;

        while(!stack.isEmpty()){
            const node = stack.pop();
            if(!node.isLeaf){
                cost += node.aabb.area();

                stack.push(node.left);
                stack.push(node.right);
            }
        }
        
        return cost;
    }

    draw(g: Graphics, node = this.root) {
        if(node === null) return;

        // Internal Node
        node.aabb.draw(g);

        // Leaf Node
        if(node.isLeaf) { 
            node.object.draw(g,0xFF0000);
        }

        this.draw(g, node.left);
        this.draw(g, node.right)
    }
}

