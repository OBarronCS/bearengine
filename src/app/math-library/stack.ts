

export interface Stack<T> {
    push(element: T): void;
    pop(): T;
    peek(): T;
    size(): number;
    isEmpty(): boolean;
}


// Linked list representation of a stack
export class StackNode<T> {
    next: StackNode<T> = null;
    item: T;
}

// In terms of performance, native JavaScript arrays are about 20-35% faster. Here's a jsbench: https://jsben.ch/Xisaw;
// Even on small data sets
export class LinkedStack<T> implements Stack<T> {
    private first: StackNode<T> = null;
    private internalSize = 0;

    push(item: T): void {
        // Adds a new node to the front of the linked list
        const currentFirst = this.first;

        this.first = new StackNode<T>();
        this.first.item = item;
        this.first.next = currentFirst;

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



