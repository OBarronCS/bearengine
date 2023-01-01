import { Attribute } from "../entityattribute";

export class SlowAttribute extends Attribute {
    constructor(public radius: number, public slow_factor: number){
        super();
    }
}

/**
 * Remember ActionAttribute snippet
 */
