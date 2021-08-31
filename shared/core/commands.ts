import { LinkedQueue, Queue } from "shared/datastructures/queue";

/* Parse and execute commands sent by clients 

How to:

"Context" --> meant to give some information about what "initiated" the command
    Probably should contain info like the engine object, what player iniated the command if on server, 

// Creates a function with the given context type bound to its generic;
const command = BindCommandCreator<TContext>();

const database = new CommandDatabase<TContext (same as above)>;

database.add(
    command("hello").run((test)=>{}))

const test = command("test").
    args(argv.string_options(["bob", "billy"]), argv.number())
        .run((context, firstName: string, arg_2: number) => {

    })

database.add(test);



command(command_name: string). // defines function name
    args(...args). // defines arguments
        run((source, ...args) => { // if the command is called succesfully, this callback is called

        });
*/


// Responsible for one type of command
interface CommandArgumentParser<T> {
    parse(queue: Queue<string>): T // reads from queue, does validation
    hint(): string[];
}


class DoubleNumberParser implements CommandArgumentParser<number>{

    parse(queue: Queue<string>): number {
        const passedInString = queue.dequeue();

        const double = parseFloat(passedInString);
 
        return double;
    }

    hint(): string[] {
        return ["number"];
    }
}

// Allows a given string in a given list
// Generic allows you to provide a union with multiple string types
class StringOptionsParser<TStringOptions extends string = string> implements CommandArgumentParser<TStringOptions>{

    readonly options: Set<string>;

    constructor(options: string[]){
        this.options = new Set(options);
    }

    parse(q: Queue<string>): TStringOptions {
        const passedInString = q.dequeue();


        if(!this.options.has(passedInString)){
            throw new Error("AHHHHH");
        }

        //@ts-expect-error
        return passedInString;
    }

    hint(): string[] {
        return [...this.options];
    }
}



// stands for CommandVariable
export const comv = {
    string_options<T extends string = string>(options: string[]){
        return new StringOptionsParser<T>(options);
    },
    number(){
        return new DoubleNumberParser();
    }
}

type TypescriptTypes<T extends readonly CommandArgumentParser<any>[]> = {
    [Key in keyof T]: T[Key] extends CommandArgumentParser<infer R> ? R : never;
};



// Holds all the information for a given command.
class CommandParser<TParsers extends readonly CommandArgumentParser<any>[], TContext> {

    public readonly name: string;
    private argParsers: TParsers;
    private commandCallback: (context: TContext, ...args: TypescriptTypes<TParsers>) => void;

    constructor(name: string, argParsers: TParsers, commandCallback: CommandParser<TParsers,TContext>["commandCallback"]){
        this.name = name;
        this.commandCallback = commandCallback;
        this.argParsers = argParsers;
    }

    parse(context: TContext, args: Queue<string>): void {
        const realArgs = []

        for(const parser of this.argParsers){
            realArgs.push(parser.parse(args))
        }

        this.commandCallback(context, ...(realArgs as any as TypescriptTypes<TParsers>));
    }
}


function commandCreator<TContext>(command_name: string){    
    return {
        args<T extends [...CommandArgumentParser<any>[]]>(...argDef: T){
            
            return {
                run(callback: (context: TContext, ...args: TypescriptTypes<T>) => void ){
                    return new CommandParser(command_name, argDef, callback);
                }
            }
        },
        run(callback: (context: TContext) => void){
            return new CommandParser(command_name, [], callback);
        }
    }
}

// Binds a context type to the commandCreator function. For autocomplete/type-safety.
export function BindCommandCreator<TContext>(){
    return function(command_name: string){
        return commandCreator<TContext>(command_name)
    }
}

export class CommandDatabase<TContext> {

    private commands: Map<string, CommandParser<any, TContext>> = new Map();

    parse(context: TContext, command: string){
        const words = command.trim().split(" ");

        const command_name = words[0];

        const handler = this.commands.get(command_name);

        if(handler !== undefined){

            const queue = new LinkedQueue<string>();

            for(let i = 1; i < words.length; i++){
                queue.enqueue(words[i]);
            }

            handler.parse(context,queue)
        } else {
            console.log("UNKNOWN COMMAND: " + command_name)
        }
    }

    add(command: CommandParser<any, TContext>){
        this.commands.set(command.name, command);
    }
}


