
import { random_int } from "shared/misc/random";



// Used for simple iteration. Performance is of course not as fast as a for loop with defined start and end
/** [min, max). Step must be positive */
export function range(min: number, max: number, step: number = 1): Iterable<number> {
    const arr = [];
    for(let i = min; i < max; i += step){
        arr.push(i)
    }
    return arr;
}

/** Returns true if the array contains duplicate values */
export function containsDuplicates<T extends number | string>(arr: readonly T[]): boolean {
    const set = new Set<T>();

    for(const val of arr){
        if(set.has(val)) return true;
        set.add(val);
    }

    return false;
}

/** Returns list of all values that are duplicates. Uses triple equals === */
export function arrayDuplicates<T>(arr: readonly T[]): T[] {
    const duplicates: T[] = [];

    const seen = new Set<T>();
    for(const val of arr){
        if(seen.has(val)) duplicates.push(val);
        else seen.add(val);
    }

    return duplicates;
}

/** Checks if two arrays have the same contents, assuming both are sorted. */
export function areEqualSorted<T extends (number | string)>(first: readonly T[], second: readonly T[]): boolean {
    if(first.length !== second.length) return false;

    for(let i = 0; i < first.length; i++){
        if(first[i] !== second[i]) return false;
    }

    return true;
}

/**  Returns all elements of A that are not in B */
export function arrayDifference<T>(A: readonly T[], B: readonly T[]): T[] {
    const diff = new Set(A);

    for(const x of B){
        if(diff.has(x)) diff.delete(x);
    }

    return [...diff];
}

/** In-place, "Knuth/Fisher-Yates" shuffle */
export function shuffle<T>(arr: T[]): T[] {
    for(let i = arr.length - 1; i > 0; i--){
        const r = random_int(0,i+1);
        swap(arr, i, r)
    }

    return arr;
}


export function filledArray<T>(size: number, value: T): T[] {
    const arr: T[] = [];
    for(let i = 0; i < size; i++){
        arr.push(value);
    }
    return arr;
}


export function swap(arr: any[], i: number, j: number): void {
    const val1 = arr[i];
    arr[i] = arr[j];
    arr[j] = val1;
}

export function swap_with_last(arr: any[], i: number): void {
    const val1 = arr[i];
    arr[i] = arr[arr.length - 1];
    arr[arr.length - 1] = val1;
}

/** Array must contain at least one element */
export function choose<T>(elements: readonly T[]): T {
    const index = random_int(0,elements.length);
    return elements[index];
}

/** Array must contain at least one element. If there are equal amounts, returns a random one. */
export function most_frequent_choose(elements: readonly number[]): number {
    const map = new Map();
    for(const e of elements){
        if(map.has(e)) {
            map.set(e, map.get(e) + 1);
        } else {
            map.set(e, 1);
        }
    }

    let max: number = map.keys()[0];
    for(const key of map.keys()){
        if(map.get(key) > map.get(max)){
            max = key;
        }
    }

    return max;
}

export function isSorted(arr: readonly number[]): boolean {
    for(let i = 1; i < arr.length; i++){
        if(arr[i - 1] > arr[i]) return false;
    }

    return true;
}

export function arrayMin(array: readonly number[]){
    let min = array[0];
    for(let i = 1; i < array.length; i++){
        if(array[i] < min){
            min = array[i];
        }
    }
    return min;
}

export function arrayMax(array: readonly number[]){
    let max = array[0];
    for(let i = 1; i < array.length; i++){
        if(array[i] > max){
            max = array[i];
        }
    }
    return max;
}


/**
 * Returns index of key in sorted array, else returns the negative nth index of where it should go
 * ex: returns -1, it goes into the 1st index, which is 0.
 */
export function binarySearch(arr: readonly number[], key: number): number {
    let lo = 0;
    let hi = arr.length - 1;

    let index = arr.length;

    while(lo <= hi){
        index = Math.floor((lo + hi) / 2);
        if(key === arr[index]) { return index; }
        else if(key > arr[index]) lo = index + 1;
        else hi = index - 1;
    }

    return (-lo - 1);
}

/**
 * Selection Sort:
 * In iteration i, find the minimum of the remaining entries and swap it with i;
 * Quadratic time no matter the input.
 */
export function selectionSort(arr: number[]): void {
    
    for(let i = 0; i < arr.length - 1; i++){
        // Finds min of remaining array values
        let min = arr[i]
        let minIndex = i;

        for(let j = i + 1; j < arr.length; j++){
            if(arr[j] < min) { 
                min = arr[j];
                minIndex = j;
            }
        }

        swap(arr, i, minIndex);
    }
}


/**
 * Insertion Sort:
 * In iteration i, swap a[i] with each larger entry to its left.
 * great for partially sorted arrays, still quadratic worst case
 * 
 * To sort range, use optional parameters: [start,end)
 */
export function insertionSort(arr: number[], start = 0, end = arr.length): void {
    
    for(let i = start + 1; i < end; i++){
        const value = arr[i];
        // What this does is move every element up the array until we get to the point that arr[i] goes into
        // Its more efficient than swapping every pair. Less array accesses and swapping.
        let j = i - 1;
        for(; j >= start; j--){
            if(arr[j] > value){
                arr[j + 1] = arr[j];
            } else {
                break;
            }
        }  

        arr[j + 1] = value
    }
}


const gaps = [929,505,209,109,41,19,5,1]
/**
 * Similar to insertion short, but instead of swapping with neighbours, swap in gaps
 * Jumps it from quadratic to n^4/3 if the gaps are good. --> https://oeis.org/A033622
 */
export function shellSort(arr: number[], start = 0, end = arr.length): void {
    for(const gap of gaps){
        for(let i = start + gap; i < end; i++){
            const value = arr[i];
            // What this does is move every element up the array until we get to the point that arr[i] goes into
            // Its more efficient than swapping every pair. Less array accesses and swapping.
            let j = i - gap;
            for(; j >= start; j -= gap){
                if(arr[j] > value){
                    arr[j + gap] = arr[j];
                } else {
                    break;
                }
            }  

            arr[j + gap] = value
        }
    }
}

export function mergeSort(arr: number[], start = 0, end = arr.length): void {
    const backingArray = [...arr];
    _merge(arr, start, end-1, backingArray);
}

function _merge(arr: number[], lo: number, hi: number, backingArray: number[]){
    const mid = Math.floor((lo + hi) / 2) 
    if(lo < hi){
        // flips the backing and real array every time so it never needs to copy the array
        _merge(backingArray,lo, mid, arr);
        _merge(backingArray, mid + 1, hi, arr);
        _sortDividedArrays(backingArray, lo, mid, hi, arr);
    }
}

function _sortDividedArrays(arr: number[], lo: number,mid: number, hi: number, backingArray: number[]){
    let i = lo;
    let j = mid + 1;

    let k = lo;
    while(k <= hi){
        if(i !== mid + 1 && (j === hi + 1 || arr[i] <= arr[j])) {
            backingArray[k] = arr[i]
            i++;
        }
        else {
            backingArray[k] = arr[j]
            j++;
        }

        k++;
    }
}




// QUICKSORT
/*
first, shuffle array
partition it so that for some j, a[j] is in place, all values below it are smaller, all on right are greater

choose an arbitrary index j (like the first element), then have two pointers
lo and hi. move lo up until get to an element greater than arr[j], move hi down until come acorss someonthing less than j, than swap i and j. repeat until partitioned and j is in place
then, exchanging j with the index where lo and hi crossover
*/

export function quickSort(arr: number[]): void {
    shuffle(arr);
    _internalQuickSort(arr,0,arr.length - 1);
}

function _internalQuickSort(arr: number[], lo: number, hi: number){
    if(hi <= lo) return;
    const j = quickSortPartition(arr, lo, hi);
    _internalQuickSort(arr,lo, j - 1);
    _internalQuickSort(arr,j + 1, hi)
}

function quickSortPartition(arr: number[], lo: number, hi: number): number {
    let i = lo + 1; //bottom pointer
    let j = hi // top pointer
    let inplace = arr[lo];

    while(true){
        // move bottom pointer up
        while(arr[i] < inplace){
            i++
            if(i === hi) break;
        }

        while(arr[j] > inplace){
            j--
        }

        // j went past i, meaning it is partitioned at this point
        if(j <= i) break;

        swap(arr,i,j);
        i++;
        j--;
    }

    swap(arr,lo,j);

    return j;
}








