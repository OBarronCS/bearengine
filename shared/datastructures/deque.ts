

class Node<T> {
    constructor(public value: T, public left: Node<T>, public right: Node<T>){}
}

/** Implemented as a doubly linked list */
export class Deque<T> {

    private dummyLeft = new Node<T>(null, null, null);
    private dummyRight = new Node<T>(null, null, null);

    private count = 0;

    constructor(){
        this.dummyLeft.right = this.dummyRight;
        this.dummyRight.left = this.dummyLeft;
    }
    
    

    size(): number {
        return this.count;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    pushLeft(value: T){
        const newNode = new Node(value, this.dummyLeft, this.dummyLeft.right);
        

        this.dummyLeft.right.left = newNode;
        this.dummyLeft.right = newNode;

        this.count += 1;
    }

    popLeft(): T {
        if(this.size() === 0) return null;

        const value = this.dummyLeft.right;

        this.dummyLeft.right = value.right;
        value.right.left = this.dummyLeft;


        value.right = null;
        value.left = null;


        this.count -= 1;

        return value.value;
    }

    peekLeft(): T | null {
        return this.dummyLeft.right.value;
    }
   

    pushRight(value: T){
        const newNode = new Node(value, this.dummyRight.left, this.dummyRight);
        
        this.dummyRight.left.right = newNode;
        this.dummyRight.left = newNode;

        this.count += 1;
    }

    popRight(){
        if(this.size() === 0) return null;

        const value = this.dummyRight.left;

        this.dummyRight.left = value.left;
        value.left.right = this.dummyRight;


        value.right = null;
        value.left = null;

        this.count -= 1;

        return value.value;
    }

    peekRight(): T | null {
        return this.dummyRight.left.value;
    }

    // Default, forwards iterator
    [Symbol.iterator](): Iterator<T> {
        let node = this.dummyLeft;

        return {
            next(){ 
                node = node.right;
                return { value: node.value, done: node.right === null };
                
            }
        }
    }

    forwardsIterator(): Iterator<T> {
        return this[Symbol.iterator]()
    }

    backwardsIterator(): Iterator<T> {
        let node = this.dummyRight;

        return {
            next(){ 
                node = node.left;
                return { value: node.value, done: node.left === null };
            }
        }
    }


    toString(): string {
        return [...this].toString();
    }
    
}



