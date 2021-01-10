




// Only polling for now


// T is all the names of the events
interface InputController<T> {
    startCommand(action: T): boolean;
    command(action: T): boolean;
    endCommand(action: T): boolean;
}



export class PlayerActionController implements InputController<""> {
    startCommand(action: ""): boolean {
        throw new Error("Method not implemented.");
    }
    command(action: ""): boolean {
        throw new Error("Method not implemented.");
    }
    endCommand(action: ""): boolean {
        throw new Error("Method not implemented.");
    }
    
}



