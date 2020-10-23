

export interface Stack<T> {
    push(element: T): void;
    pop(): T;
    peek(): T;
    size(): number;
    isEmpty(): boolean;
}


// Linked list representation of a stack
export class StackNode<T> {
    public item: T;
    public next: StackNode<T>;

    constructor(item: T, next: StackNode<T>){
        this.item = item;
        this.next = next;
    }
}

// In terms of performance, native JavaScript arrays are about 20-35% faster. Here's a jsbench: https://jsben.ch/mVear
// Even on small data sets
export class LinkedStack<T> implements Stack<T> {
    protected first: StackNode<T> = null;
    protected internalSize = 0;

    push(item: T): void {
        // Adds a new node to the front of the linked list
        this.first = new StackNode<T>(item,this.first);
        this.internalSize += 1;
    }

    /**
     * null if empty
     */
    pop(): T {
        if(this.first !== null){
            this.internalSize -= 1;
            const item = this.first.item;
            this.first = this.first.next;
            return item;
        }
        return null;
    }

    /**
     * null if empty
     */
    peek(): T {
        if(this.first !== null){
            return this.first.item;;
        }
        return null;
    }

    size(): number {
        return this.internalSize;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    // Allows the use of 'for of' loops
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



// basically a stack, but using this class signals you are using it for a different purpose
// will allows index based access and deleting, contains, delete
// meant for small amount of values
// For real JavaScript performance, arrays are very optimized and quicker anyways
export class LightLinkedBag<T> extends LinkedStack<T> {
    contains(value: T): boolean {
        for(let x = this.first; x != null; x = x.next){
            if(x.item == value) return true;
        }
        return false;
    }
}


