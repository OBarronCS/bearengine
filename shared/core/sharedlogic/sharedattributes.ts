import { Attribute } from "../entityattribute";

export class SlowAttribute extends Attribute {
    constructor(public radius: number, public slow_factor: number){
        super();
    }
}


/** Abstract to force each type to be a subclass 
 * 
 * INSTEAD THIS SHOULD BE A SNIPPET
*/
abstract class ActionAttribute<T extends (...data: any[]) => void> {

    constructor(private callback: T){}

    execute(...data: Parameters<T>) {
        this.callback(...data);
    };
}

/** Example usage */
// class Boomable extends ActionAttribute<(a: number, b: string) => void> {}

// const b = new Boomable((a,b) => {});
// b.execute(12, "hello")

