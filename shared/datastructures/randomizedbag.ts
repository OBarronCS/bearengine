

import { randomInt } from "shared/randomhelpers";
import { shuffle } from "./arrayutils";


// A randomized "bag" of data. Remove values in random order. Iteration is in random order.
export class RandomizedBag<T> {

    // size - 1 = index last value;
    private internalSize = 0;
    private items: T[] = [];

    // is the randomized queue empty?
    public isEmpty() {
        return this.internalSize === 0;
    }

    // return the number of items on the randomized queue
    public size() {
        return this.internalSize;
    }

    // add the item
    public add(item: T) {
        this.items[this.internalSize++] = item;
    }

    // remove and return a random item
    public random(): T {
        if (this.isEmpty()) return null;

        const index = randomInt(0,this.internalSize);
        const item: T = this.items[index];

        // put the end of the array value to this index
        this.items[index] = this.items[this.internalSize - 1];
        this.items[this.internalSize - 1] = null;
        this.internalSize--;

        return item;
    }


    // return a random item (but do not remove it)
    public sample(): T {
        if (this.isEmpty()) return null;

        const index = randomInt(0,this.internalSize);
        return this.items[index];
    }

    // return an independent iterator over items in random order
    // linear time, linear space per iterator
    [Symbol.iterator](){
        const arrayCopy: T[] = [...this.items];
        shuffle(arrayCopy);
        let currentIndex = 0;
        
        const iterator = {
            next: () => {
                if(currentIndex !== arrayCopy.length){
                    const item = arrayCopy[currentIndex++];
                    return { value: item, done: false };
                } 
            
                return { value: null, done: true };
            }
        };
        return iterator;
    }
}



