




export const log = (a: any) => console.log(a);



// runs a function a couple times and checks how long on average each iteration takes

export function benchmarch(func: () => void, iterations: number) {
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
        func();
    }

    return (performance.now() - startTime) / iterations;
}


