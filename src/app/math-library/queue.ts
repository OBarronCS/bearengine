import { TilingSprite } from "pixi.js";
import { StackNode } from "./stack";


export interface Queue<T> {
    enqueue(item: T): void;
    dequeue(): T;
    size(): number;
    isEmpty(): boolean;
}


/// This is MUCH faster than using native JS arrays for queue (at least in the V8 engine)
/// I tested it on jsbench --> https://jsben.ch/6ySlJ
// This is faster than the ArrayQueue implementation at the bottom of the page for this use case. As data set increases (array of thousands of values), they become pretty much the same speed and then FastQueue wins
export class LinkedQueue<T> implements Queue<T> {
    
    private first: StackNode<T> = null;
    private last: StackNode<T> = null;
    private internalSize = 0;
    
    enqueue(item: T): void {
        const currentLast = this.last;
    
        this.last = new StackNode<T>();
        this.last.item = item;

        if(this.internalSize === 0){
            this.first = this.last
        } else {
            currentLast.next = this.last;
        }

        this.internalSize += 1;        
    }
    
    dequeue(): T {
        if(this.first === null) return null;
        const item = this.first.item;
        this.first = this.first.next
        this.internalSize -= 1;

        return item;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    size(){
        return this.internalSize;
    }

    [Symbol.iterator](){
        let currentNode: StackNode<T> = this.first;
        const iterator = {
            next: () => {
                if(currentNode !== null){
                    const item = currentNode.item;
                    currentNode = currentNode.next;
                    return { value: item, done: false };
                } 
            
                return { value: null, done: true };
            
            }
        };
        return iterator;
    }

}

// 
export class ArrayQueue<T> implements Queue<T> {

    private innerArray: T[] = [];
    private startPointer = 0;

    enqueue(t: T){
        this.innerArray.push(t);
    }

    dequeue(){
        let item = this.innerArray[this.startPointer];
        this.startPointer += 1;

        // Once the array becomes sparse enough, we cut half of it
        if(this.startPointer >= this.innerArray.length / 2){
            this.innerArray.splice(0,this.startPointer);
            this.startPointer = 0;
        }

        return item;
    }

    size(): number {
        return this.innerArray.length - this.startPointer;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    [Symbol.iterator](){
        let pointer = this.startPointer;
        const iterator = {
            next: () => {
                if(pointer !== this.innerArray.length){
                    const item = this.innerArray[pointer];
                    pointer += 1;
                    return { value: item, done: false };
                } 
            
                return { value: null, done: true };
            
            }
        };
        return iterator;
    }
}


