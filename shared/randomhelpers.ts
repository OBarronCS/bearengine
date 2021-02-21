
/*
random number functions
look into chancejs
*/

/** [0,1 or max?) */
export function random(max: number = 1): number {
    return Math.random() * max;
}
/** [min,max) */
export function random_range(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/** [min, max) */
export function randomInt(min: number, max: number): number{
    return min + Math.floor(Math.random() * (max - min));
}

/**
 * returns true/or false, with the percent chance of true being the argument
 * @param percent 0-100
 */
export function chance(percent: number): boolean {
    return random() < (percent/100);
}


const allChars = "!@#$%^&*()abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'"; 
export function randomChar(){
    return allChars.charAt(randomInt(0,allChars.length));
}


// An iterable with random amount of integers in a range
/** [min, max) , chance of each one appearing */
export function randomRangeSet(min:number, max: number,percent: number){
    return { 
        [Symbol.iterator](){
            const array = []
            for(let i = min; i < max; i++){
                if(chance(percent)) array.push(i);
            }
            let index = 0;
            
            const iterator = {
                next: () => {
                    if(index < array.length){
                        return { value: array[index++], done: false };
                    } 
                
                    return { value: null, done: true };
                }
            };
            return iterator;
        }
    }
}

// Takes a function that returns some value, fills an array with return value of n function calls
export function fillFunction<T>(func: () => T, amount: number){
    const arr: T[] = [];
    for(let i = 0; i < amount; i++){
        arr.push( func() );
    }
    
    return arr;
}

