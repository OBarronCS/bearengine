


// export function assert(test: boolean, info?: string): asserts test is true  {
//     if(test === false) throw new Error(`Assert statement failed! ${info}`)
// }

// call this in default case of switch statement with a case that has a bounded type
// this ensures that I manually add everything at compile time
export function AssertUnreachable(impossibleCase: never): never {
    throw new Error(`ERROR: ${impossibleCase} somehow got through at run time!`);
}

export function AssertNotUndefined(value: any): void {
    if(value === undefined) throw new Error(`ERROR: Undefined value`);
}

