


import { PlayerActions } from "../gamelogic/player";


// Or make the abstraction just an interface that the player creates and that a 
// we need to implement and give into the constructor
/*

// should all be methods
interface PlayerActions {
    left(): boolean;
    jump(): boolean:
    right(): boolean:


    // How handle mouse click and position though?
    // maybe just call it mouse("buttons"|ect) and mousePosition()? 
    // and just on server don't care if it is really a mouse of now?

}



*/




// T is all the names of the events
interface InputController<T> {
    startCommand(action: T): boolean;
    command(action: T): boolean;
    endCommand(action: T): boolean;
}



export class PlayerActionController implements InputController<PlayerActions> {
    
    startCommand(action: PlayerActions): boolean {
        throw new Error("Method not implemented.");
    }

    command(action: PlayerActions): boolean {
        throw new Error("Method not implemented.");
    }

    endCommand(action: PlayerActions): boolean {
        throw new Error("Method not implemented.");
    }
    

    
}



