

/** [0,1 or max?) */
export function random(max: number = 1): number {
    return Math.random() * max;
}

/** [min,max) */
export function random_range(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/** [min, max) */
export function random_int(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min));
}



/** Fast "random" number, (0,1) */
export function random_hash(seed: number): number {
    return ((((Math.sin(781 + seed * 43758.5453) * 65309.16832) % 1) + 1) / 2);
}


// About -1 to 1, just for testing before I get real perlin noise
export function smoothNoise(seed: number): number {
	return (Math.sin(7*seed) + Math.sin(Math.PI * seed) + Math.cos(11*seed))/3
}

/**
 * returns true/or false, with the percent chance of true being the argument
 * @param percent 0-1
 */
export function chance(percent: number): boolean {
    return random() < percent;
}


const allChars = "!@#$%^&*()abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'"; 
export function randomChar(){
    return allChars.charAt(random_int(0,allChars.length));
}


// An iterable with random amount of integers in a range
/** [min, max) , chance of each one appearing */
export function randomRangeSet(min:number, max: number,percent: number): Iterable<number> {
    return { 
        [Symbol.iterator](){
            const array = []
            for(let i = min; i < max; i++){
                if(chance(percent)) array.push(i);
            }

            return array[Symbol.iterator]();
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

