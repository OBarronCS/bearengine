

import { random_int } from "shared/misc/random";
import { shuffle } from "./arrayutils";


// A randomized "bag" of data. Remove values in random order. Iteration is in random order.
export class RandomizedBag<T> {

    private items: T[] = [];

    // is the randomized queue empty?
    public isEmpty() {
        return this.items.length === 0;
    }

    // return the number of items on the randomized queue
    public size() {
        return this.items.length;
    }

    // add the item
    public add(item: T) {
        this.items.push(item);
    }

    // remove and return a random item
    public random(): T {
        if (this.isEmpty()) return null;

        const index = random_int(0,this.items.length);
        const item: T = this.items[index];

        // put the end of the array value to this index
        this.items[index] = this.items[this.items.length - 1];
        this.items.pop();

        return item;
    }


    // return a random item (but do not remove it)
    public sample(): T {
        if (this.isEmpty()) return null;

        const index = random_int(0,this.items.length);
        return this.items[index];
    }

    // return an independent iterator over items in random order
    // linear time, linear space per iterator
    [Symbol.iterator](): Iterator<T> {
        const array_copy: T[] = [...this.items];
        shuffle(array_copy);
        return array_copy[Symbol.iterator]();
    }
}



