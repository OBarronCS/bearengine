

import { Entity } from "./entity";


// Testing around with event registering using decoraters
// Decorator is only called once, so need to figure out how to connect that to events for each instance:
/*
Idea) 
    Add the event name and method string to a list on target.constuctor (first check if exists, if not, create)
    when "add" an instance of this object to the game, check this static property of the constructor,
    and iterate all event names and strings, and attach them to the correct event emitters


    When systems are 'init'ed, it grabs these eventregistryhandlers, and gives it to the central event repo.
        Then, when listeners are registered, it takes the event name, finds the handler, and passes the info to it:

  
        // EventRegistry is a member variable of the systems
        The registry holds the data to be able to distribute callbacks to the right methods (objects, method name, additional data for events if needed)
        - O(1) access by class name, data.
        The system itself needs to implement filtering. 


        On init, all systems give their EventRegistry's, specifying its event name, to the central distributor.

        Registering step for collision with other entity:
        1) Decorator on method (specifies EventName):
        2) Entity added to world, check static list of [eventname, methodname, additional data]
        3) Data is passed to EventRegistry which holds it (can just be a passthrough for simple or domain specific events)
        EventRegistry lives on the System . . . 

        To emit collision data:
        1) CollisionSystem, as it moves things, is adding objects to a set of collisions
        2) For each one, see if there is match in the EventRegistry. If so, calls callback immediately? 

        Ex. no 2. mouse tap event
        1) Decotoer, @bearevent("tap")
        2) Entity added to world, checks it's static list
        3) instance, method, given to Eventregistry associated with "tap",
        
        to emit: 
        1) Some system that has init the "tap" handler polls for mouse click
        2) if so, find any entity below mouse
        3) If find one, check if it exists in the registry, then call the event 

*/


{
    interface GameEvents {
        "mousedown": (mousePoint: number, name: string) => void,
        "typed": (num: string) => void,
    }

    function bearevent<T extends keyof GameEvents>(name: T) {
        return function<ClassType extends Entity /* substitute any with ClassType */>(target: any, propertyKey: keyof any, descriptor: TypedPropertyDescriptor<GameEvents[T]>){
            // Now I can use this propertyKey to attach the event handler
            const test = target[propertyKey];
        }
    }

    class Test {
        
        @bearevent("mousedown")
        onMouseDown(num: number) {

        }
    }
}


{
    // Other way to do it: method name must be exactly the name of the event it is attaching to,
    // Decorator still needed, so its cool with the template type, but not practical, as its a bit to implicit for my taste
    // Decorator is just @bearevent, and using string template typing, we can connect it directly to the type:
    // propertyKey: `${T}` where is keyof GameEvent, so that the method name corresponds to some event
    interface GameEvents {
        "mousedown": (mousePoint: number, name: string) => void,
        "typed": (num: string) => void,
    }

    function namedbearevent<T extends keyof GameEvents>(target: any, propertyKey: `${T}`, descriptor: TypedPropertyDescriptor<GameEvents[T]>){

    }

    class Test {
        
        @namedbearevent
        mousedown(num: number) {

        }
    }
}


{
    

    interface Core {
        [key: string] : {
            register_args: any[];
            callback: Function
        }
    }

    interface GameEvents extends Core {
        "mousedown": { 
            register_args: [num: number, str: string]
            callback: (mousePoint: number, name: string) => void,
        }
        "typed": { 
            register_args: []
            callback: (num: string) => void 
        }
    }

    // First arg is the prototype, second is method name, last 
    function gameevent<T extends keyof GameEvents>(name: T, ...args: GameEvents[T]["register_args"]) {

        return function(target: any, 
                        propertyKey: string, 
                        descriptor: TypedPropertyDescriptor<GameEvents[T]["callback"]>){
            // Now I can use this propertyKey to attach the event handler
            console.log(target.test)
            console.log(target.constructor.test)
            const test = target[propertyKey];
        }
    }

    class Test {
        
        static test = ["Hi", "nope"];

        list = []

        test2(){
            console.log(this.list);
        }

        @gameevent("mousedown", 123, "hello")
        onMouseDown(num: number, name: string) {

        }
    }
}
/*
Other idea for events: have them be member variables

private collideCallback = this.addEvent("mousedown", callback);

Would make canceling the callback a bit easier I think, althoght I think I will go with decoraters due to their ease and it
just looks nicer syntax wise;

*/



// {
//     2) Option 2 MAYBE: 
//         Special decorators for domain specific events?  
//         @collisionevent("type",[list of other CollisionPart tags to check or something like that]);

//         Make a decorator factory factory in this case to simplify the creation 
//     }