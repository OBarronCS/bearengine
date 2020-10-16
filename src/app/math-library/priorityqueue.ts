
/*
An implementation of a priority queue using a binary heap:
A binary heap is a complete binary tree, with each parent equal to or greater than its two children.

Array representation of heap:
Parent of a node is at floor(k/2), children of are at 2k and 2k+1.
//assuming k starts at 1 --> do some math to convert to 0 based
*/

import { swap } from "./arrayshelper"

// Highest priority items will be at the front of the queue
// In the priority function, a higher number indicates a higher priority
export class PQ<T> {

    private arr: T[] = []
    private compareFunction: (a:T, b:T) => number;
    private N: number = 0;

    constructor(compareFunction: (a:T, b:T) => number) {
        this.compareFunction = compareFunction;
    }

    public peepMax(): T {
        return this.arr[0];
    }

    // TODO: once array gets small enough, splice it to get rid of the null indices.
    public popMax(): T {
        if(this.isEmpty()) return null;
        const max = this.arr[0];
        swap(this.arr,0, this.N - 1);
        this.N -= 1;
        binaryheapSink(this.arr,0,this.N,this.compareFunction);
        this.arr[this.N] = null;
        return max;
    }

    public add(value: T){
        // adds it to bottom leaf of heap, and swims it up
        this.arr[this.N++] = value;
        binaryheapSwim(this.arr,this.N - 1, this.compareFunction);
    }

    public size(){ return this.N; }

    public isEmpty(){ return this.size() === 0; }

    public toString(): string { return this.arr.toString(); }

    // An iterator that goes through the structure and pops things as it goes
    // queue will be empty at the end of the for..of loop

    // Might convert this to a generator function, will be functionally the same
    popIterator(): Iterable<T> {
        let pq = this;
        return {
            [Symbol.iterator](){
                const iterator = {
                    next: () => {
                        if(!pq.isEmpty()){
                            return { value: pq.popMax(), done: false };
                        } 
                        return { value: null, done: true };
                    }
                };
                return iterator;
            }
        }
    }
}

/// in-place nlogn, non-stable
export function binaryHeapSort<T>(arr: T[], compareFunction: (a:T, b:T) => number){
    heapify(arr, compareFunction);
    
    let N = arr.length;
    while(N > 0) {
        // Swap max to bottom
        swap(arr,0,--N)
        binaryheapSink(arr,0,N,compareFunction);
    }
}

// turns an array into a binary heap
function heapify<T>(arr: T[], compareFunction: (a:T, b:T) => number) {
    let N = arr.length;

    for(let k = Math.floor((N - 1) / 2); k >= 0; k--){
        binaryheapSink(arr, k, N,compareFunction);
    }
}

function binaryheapSwim<T>(arr: T[], k: number, compareFunction: (a:T, b:T) => number) {
    // While the current one is greater than the above it, swap it up
    while(k > 0 && compareFunction(arr[k],arr[Math.floor((k-1)/2)]) > 0){
        swap(arr,k, Math.floor((k - 1)/2));
        k = Math.floor((k - 1)/2);
    }
}

function binaryheapSink<T>(arr: T[], k: number, N:number, compareFunction: (a:T, b:T) => number) {
    while(2*k + 1 < N){
        let j = (2*k) + 1;
        // Pick the greater of the two children
        if(j < (N - 1) && compareFunction(arr[j], arr[j+1]) < 0) j++;
        // if this is greater than or equal, stop sinking.
        if(compareFunction(arr[k],arr[j]) >= 0) break;
        swap(arr, k, j);
        k = j;
    }
}

