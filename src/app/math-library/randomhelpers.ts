
/*
random number functions
look into chancejs
*/

/**
 * [0,1 or max?)
 */
export function random(max: number = 1): number {
    return Math.random() * max;
}

export function random_range(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

 /**
 * [min, max)
 * @param min inclusive
 * @param max not-inclusive
 */
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


// Takes a function that returns some value, fills an array with return value of n function calls
export function fillFunction<T>(func: () => T, amount: number){
    const arr: T[] = [];
    for(let i = 0; i < amount; i++){
        arr.push( func() );
    }
    
    return arr;
}

