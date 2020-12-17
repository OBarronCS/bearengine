import { TilingSprite } from "pixi.js";
import { LinkedStack } from "./stack";



// Doubly circular linked list
export class CircularLinkedList<T> {

    private first: LinkedNode<T> = null;
    private last: LinkedNode<T> = null;
    private internalSize = 0;

    private nextLink: LinkedNode<T> = null;
    
    /** Appends to last node */
    add(item: T): void {
        const currentLast = this.last;
    
        this.last = new LinkedNode<T>(item,this.first,currentLast);

        if(this.internalSize === 0){
            this.nextLink = this.last;

            this.first = this.last
            // if its all alone, it is linked to itself
            this.last.next = this.last;
            this.last.last = this.last;
        } else {
            currentLast.next = this.last;
        }

        this.internalSize += 1;        
    }

    /** Holds internal state of last node visited, returns node value then moves up pointer */
    next(): T {
        if(this.nextLink === null) return null;
        const item = this.nextLink.item;
        
        this.nextLink = this.nextLink.next;

        return item; 
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    size(){
        return this.internalSize;
    }
}

class LinkedNode<T> {
    constructor(
        public item: T, 
        public next: LinkedNode<T>,
        public last: LinkedNode<T>
    ){}
}


