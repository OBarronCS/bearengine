/*
For use as a member variable, to keep track of SOMETHING and check in using 

ex:
    this.time = new TickTimer(30);

    if(this.time.tick()){
        //this get called every 30 ticks
    }
*/

export class TickTimer {
    
    // 1 or less if every tick,
    interval: number;
    repeating: boolean;
    timesRepeated = 0;
    
    counter = 0;
    
    // TODO, add settings so can have intervals [30,40,130,120]

    constructor(interval: number, repeating = true){
        this.interval = interval;
        this.repeating = repeating;
    }

    // Returns true if the timer is done, and restarts the interval
    tick(tick = true): boolean {
        if(tick){
            this.counter++;

            if(this.repeating || this.timesRepeated < 1){
                if(this.counter >= this.interval){
                    this.timesRepeated++;
                    this.counter = 0;
                    return true;
                }
            }

        }

        return false;
    }
}


