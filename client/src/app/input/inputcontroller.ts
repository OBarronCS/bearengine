import { DefineSchema } from "shared/core/sharedlogic/serialization";
import { KECode } from "../apiwrappers/keyboardapiwrapper";
import { EngineKeyboard } from "./keyboard";
import { EngineMouse, MouseButton } from "./mouse";


/**
    const player_controls = CreateInputConverter(
        {
            
        }
    );

    const input_controller = new InputController(keyboard_source, player_controls);


    InputManager {

        list of InputController();

        Only one active at a time (implicit):
            First one we come across that is enabled, we call the update() of then quit loop;

        FUTURE:
            on disable(){
                an input controller has its released() set positive, then we move on
            }

    }

    Passed in constructor (its just easier)

*/

type InputVariableType = {
    type: "keyboard",
    key: KECode
} | {
    type: "mouse",
    button: MouseButton
}

type InputConverter = { [K in string]: InputVariableType };

/** Input Variable */
export const inputv = {
    key<T extends KECode>(key: T){
        return {
            type:"keyboard",
            key:key
        } as const
    },
    mouse<T extends MouseButton>(button: T){
        return {
            type:"mouse",
            button:button,
        } as const
    }
}


export const CreateInputConverter = DefineSchema<InputConverter>();

/**
 * Action --> one time, "happened" "pressed"
    * action_start // key presses
    * action_end
 * States --> is down
 * Value --> Like mouse position
 */

/** Centralizes keyboard and mouse input into one interface */
export class DefaultInputController<T extends InputConverter> {
    
    enabled = true;



    constructor(public keyboard_source: EngineKeyboard, public mouse_source: EngineMouse,public controls: T){
        
    }

    enable(){
        this.enabled = true;
    }

    disable(){
        this.enabled = false;
    }


    // State
    isDown(input: keyof T): boolean {
        if(this.enabled){
            const code = this.controls[input];
            if(code.type === "keyboard"){
                return this.keyboard_source.isDown(code.key);
            } else if(code.type === "mouse"){
                return this.mouse_source.isDown(code.button);
            }
        }

        return false;
    }

    // Actions
    wasPressed(input: keyof T){
        if(this.enabled){
            const code = this.controls[input];
            if(code.type === "keyboard"){
                return this.keyboard_source.wasPressed(code.key);
            } else if(code.type === "mouse"){
                return this.mouse_source.wasPressed(code.button);
            }
        }

        return false;
    }

    // private pressed_set = new Set<KECode>();
    wasReleased(input: keyof T){
        if(this.enabled){
            const code = this.controls[input];
            if(code.type === "keyboard"){
                return this.keyboard_source.wasReleased(code.key);
            } else if(code.type === "mouse"){
                return this.mouse_source.wasReleased(code.button);
            }
        }

        return false;
    }
}


