import { LinkedQueue, Queue } from "shared/datastructures/queue";

/* Parse and execute commands sent by clients 

Should NOT throw exceptions. Returns a CheckedResult object, with success flag.

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
    parse(queue: Queue<string>): CheckedResult<T, string> // reads from queue, does validation
    hint(): string[];
}


type CheckedResult<T, E> = IValidResult<T> | IErrorResult<E>;

interface IValidResult<T> {
    success: true,
    value: T
}

interface IErrorResult<E> {
    success: false,
    error: E
}

function ValidResult<T>(value: T): IValidResult<T> {
    return {
        success: true,
        value: value,
    }
}


function ErrorResult<E>(err: E): IErrorResult<E> {
    return {
        success: false,
        error: err
    } 
}



class DoubleNumberParser implements CommandArgumentParser<number> {

    parse(queue: Queue<string>): CheckedResult<number, string> {
        const passedInString = queue.dequeue();

        const double = parseFloat(passedInString);

        if(isNaN(double)) { 
            return ErrorResult("NaN");
        }

        if(!isFinite(double)){
            return ErrorResult("Infinity");
        }
 
        return ValidResult(double);
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

    parse(q: Queue<string>): CheckedResult<TStringOptions, string> {
        const passedInString = q.dequeue() as TStringOptions;


        if(!this.options.has(passedInString)){
            return ErrorResult(`${passedInString} not valid, must be ${[...this.options].toString()}`);
        }

        return ValidResult(passedInString);
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

    parse(context: TContext, args: Queue<string>): CheckedResult<null, string> {
        const realArgs = [];

        for(const parser of this.argParsers){

            if(args.isEmpty()){
                return ErrorResult("Missing next argument: [" + parser.hint() + "]")
            }

            const result = parser.parse(args);

            // Early exits if found error in one of the arguments
            if(result.success === false){
                return result;
            }

            realArgs.push(result.value);
        }

        this.commandCallback(context, ...realArgs as any as TypescriptTypes<TParsers>);

        return ValidResult(null);
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

    parse(context: TContext, command: string): CheckedResult<null, string> {
        const trimmedString = command.trim();

        if(trimmedString.length === 0){
            return ErrorResult("Empty command")
        }
        
        const words = trimmedString.split(" ");

        const command_name = words[0];

        const handler = this.commands.get(command_name);

        if(handler !== undefined){

            const queue = new LinkedQueue<string>();

            for(let i = 1; i < words.length; i++){
                queue.enqueue(words[i]);
            }

            const result = handler.parse(context,queue);

            return result;

        } else {
            return ErrorResult("Command name not found");
        }

    }

    add(command: CommandParser<any, TContext>){
        this.commands.set(command.name, command);
    }
}


