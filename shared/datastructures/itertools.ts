


// unzip
// filter //skips if not === true
// if num: max, min, sum

// nth
// first/last
// count() // consumes the iterator

interface ICustomIterator<T> extends Iterable<T> {
    chain<U>(other: Iterable<U>): ICustomIterator<T | U>;
    zip<U>(other: Iterable<U>): ICustomIterator<[T,U]>;
    
    find(check: (item: T) => boolean): T | null;
    skip(count: number): ICustomIterator<T>;
    take(count: number): ICustomIterator<T>;
    for_each(cb: (item: T) => void): this;
    map<U>(cb: (item: T) => U): ICustomIterator<U>;
    
    every(cb: (item: T) => boolean): boolean;
    some(cb: (item: T) => boolean): boolean;

    
    to_array(): T[];
    clone(): ICustomIterator<T>;
}

// export function iter<T>(iterable: Iterable<T>): ICustomIterator<T>;
// export function iter<T>(...vars: T[]): ICustomIterator<T>;

export function iter<T>(iterable: Iterable<T>): ICustomIterator<T> {
    return new MyIterator<T>(iterable);
}

function* chain<T,U>(a: Iterable<T>, b: Iterable<U>){
    yield* a;
    yield* b;
}

function* map<T, U>(a: Iterable<T>, cb: (item: T) => U){
    for(const item of a){
        yield cb(item);
    }
}

/** Throws error if the iterators are not the same length */
function* zip<T, U>(a: Iterable<T>, b: Iterable<U>){

    const iter_a = a[Symbol.iterator]();
    const iter_b = b[Symbol.iterator]();

    
    let val_a = iter_a.next();
    let val_b = iter_b.next();

    while(true){
        if(val_a.done !== val_b.done) throw new RangeError("Iterators must be the same length");
        
        if(val_a.done === true) return;

        yield [val_a.value, val_b.value] as [T,U];
        
        val_a = iter_a.next();
        val_b = iter_b.next();
    } 

}

export class MyIterator<T> implements ICustomIterator<T> {

    private readonly values: Iterator<T>;

    constructor(values: Iterable<T>){
        this.values = values[Symbol.iterator]();
    }
    
    [Symbol.iterator](): Iterator<T, any, undefined> {
        return this.values;
    }

    chain<U>(other: Iterable<U>): ICustomIterator<T | U> {
        return iter(chain(this,other));
    }

    /** Consumes the iterator */
    find(check: (item: T) => boolean): T | null {
        for(const value of this){
            if(check(value) === true){
                return value;
            }
        }

        return null;
    }

    for_each(cb: (item: T) => void): this {
        for(const value of this){
            cb(value);
        }

        return this;
    }

    map<U>(cb: (item: T) => U): ICustomIterator<U> {
        return iter(map(this,cb))
    }

    skip(count: number): ICustomIterator<T> {
        for(let i = 0; i < count; i++){
            this.values.next()
        }

        return this;
    }

    take(count: number): ICustomIterator<T> {
        const values: T[] = [];

        for(let i = 0; i < count; i++){
            const next = this.values.next();
            if(next.done){
                break;
            } 

            values.push(next.value);
        }

        return iter(values);
    }



    zip<U>(other: Iterable<U>): ICustomIterator<[T, U]> {
        return iter(zip(this, other))
    }


    every(cb: (item: T) => boolean): boolean {
        for(const item of this){
            if(cb(item) == false) return false;
        }

        return true;
    }

    some(cb: (item: T) => boolean): boolean {
        for(const item of this){
            if(cb(item) == true) return true;
        }

        return false;
    }

    to_array(): T[] {
        return [...this];
    }

    clone(): ICustomIterator<T> {
        return iter(this.to_array());
    }
}

