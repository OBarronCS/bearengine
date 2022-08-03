

// A map when using small positive integer keys. Fast contains() check, Fast iteration of keys and values;

/** Keys must be nonnegative integers */
export class SparseSet<V> {

    private sparse: number[] = [];
    private parallel: number[] = [];
    private dense: V[] = [];

    private initialSparseSize: number;

    // Set this to something when you know the max value of integer key
    constructor(initialSparseSize: number = 0){
        this.initialSparseSize = initialSparseSize;
        for(let i = 0; i < initialSparseSize; i++){
            this.sparse[i] = -1;
        }
    }

    
    contains(id: number): boolean {
        
        if(this.sparse.length <= id) return false;

        const value = this.sparse[id];

        if(value === -1 || value === undefined){
            return false;
        }

        return true;
    }

    /** Ignores if doesn't contain */
    remove(id: number): void {
        if(!this.contains(id)) return;

        const denseIndex = this.sparse[id];

    
        // Swap last item
        const lastIndex = this.dense.length - 1;
        
        // swap this with last entity in dense
        this.dense[denseIndex] = this.dense[lastIndex];
        this.parallel[denseIndex] = this.parallel[lastIndex];

        const swappedID = this.parallel[denseIndex];

        this.sparse[swappedID] = denseIndex;
        

        // Set the sparse to -1 to signify it's not here
        this.sparse[id] = -1;

        this.parallel.pop();
        this.dense.pop();
    }

    // Adds value, overrides if already exists
    set(id: number, value: V): V {
        this.remove(id); // if we already have it, will remove it

        const denseIndex = this.dense.push(value) - 1;
        this.parallel.push(id);

        this.sparse[id] = denseIndex;

        return value;
    }


    /** Null if not found */
    get(id: number): V | null {
        if(!this.contains(id)) return null;

        return this.dense[this.sparse[id]];
    }

    keys(): readonly number[] {
        return this.parallel;
    }

    values(): readonly V[] {
        return this.dense;
    }

    size(): number {
        return this.dense.length;
    }

    clear(): this {
        this.sparse = [];

        for(let i = 0; i < this.initialSparseSize; i++){
            this.sparse[i] = -1;
        }

        this.parallel = [];
        this.dense = [];

        return this;
    }

    toString(): string {
        return "Keys: " + this.keys().toString() + " Values: " + this.values().toString();
    }

    /** Allows removing current element while iterating */
    custom_iterator(): CustomSparseSetIterator<V> {
        return new CustomSparseSetIterator(this);
    }
}




/**
 *  Allow removing current element while iterating. 
 *      Iterates SparseSet backwards which allows removing values as we go. 
 * 
 * const it = set.custom_iterator();
 * for(const value of it){
 *      it.remove_current();
 * }
 * 
*/
class CustomSparseSetIterator<T> implements IterableIterator<T> {
    
    private values: readonly T[];
    private last_index: number;

    constructor(
        private sparseset: SparseSet<T>,
    ){
        this.values = this.sparseset.values();
        this.last_index = sparseset.values().length;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this;
    }

    next(): IteratorResult<T, any> {
        return {
            value: (this.last_index <= 0 ? undefined : this.values[--this.last_index]),
            done: this.last_index <= 0
        }
    }

    remove_current(){
        this.sparseset.remove(this.sparseset.keys()[this.last_index]);
    }
}