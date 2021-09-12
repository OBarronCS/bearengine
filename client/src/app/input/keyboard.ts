import * as Mousetrap from "mousetrap"
import { ExtendedKeyboardEvent, MousetrapInstance } from "mousetrap";
import { KECode } from "../apiwrappers/keyboardapiwrapper";

export class EngineKeyboard {

    // Things that were down last tick
    private lastKeyDownMap = new Map<KECode,boolean>();

    // Is it down at all
    private keyDownMap = new Map<KECode,boolean>();

    // Was it pressed Between this and last
    private keyPressedMap = new Map<KECode,boolean>();

    // Does not capture some keys, like backkey and forward
    private _tempAllPressedKeys: { code: KECode, char: string}[] = [];
    private allPressedKeys: { code: KECode, char: string}[] = [];

    // Was it released between this an last tick
    private keyReleasedMap = new Map<KECode,boolean>();


    private mousetrap: MousetrapInstance;



    init(target: Window){
        target.addEventListener("blur", e => {
            // Could iterate this and put all values into "keyReleasedMap" than clear it;
            // console.log("blur")
            this.keyDownMap.clear();
            this.keyPressedMap.clear();
            this.keyReleasedMap.clear();
        });


        const form = target;
    
        //The types definitions are incorrect as you can bind a window
        //https://github.com/ccampbell/mousetrap/issues/247
        ///@ts-expect-error
        this.mousetrap = new Mousetrap(form);

        form.addEventListener("keydown",(e) => {
            this.keyDownMap.set(e.code as KECode,true);
            
            this._tempAllPressedKeys.push({
                code: e.code as KECode,
                char: e.key
            });
        });
        
        form.addEventListener("keyup",(e) => {
            this.keyDownMap.set(e.code as KECode,false);
        });
    }

    /** Returns information on all keyboard presses in last tick. Any key */
    pressedKeyInfo(): Readonly<EngineKeyboard["allPressedKeys"]> {
        return this.allPressedKeys;
    }

    update(){
        this.allPressedKeys = [];

        this.allPressedKeys.push(...this._tempAllPressedKeys);
        this._tempAllPressedKeys = [];

        // run before update loop
        // what things did I have down LAST run
        this.keyPressedMap.clear();
        this.keyReleasedMap.clear();

        for(const [key, val] of this.keyDownMap){
            // Check for press event
            // get value can only be true or false here
            if(this.keyDownMap.get(key)){
                if(!this.lastKeyDownMap.get(key)){
                    this.keyPressedMap.set(key, true)
                }
            } else {
                if(this.lastKeyDownMap.get(key)){
                    this.keyReleasedMap.set(key, true)
                }
            }
        }

        this.lastKeyDownMap = new Map(this.keyDownMap);
    }

    /** Return true if all keys are down */
    public isDown(...codes: KECode[]): boolean {
        for(const code of codes){
            if(!this.keyDownMap.has(code) || !this.keyDownMap.get(code)){
                return false;
            }
        }

        return true;
    }

    public wasPressed(code: KECode): boolean {
        return this.keyPressedMap.has(code) && this.keyPressedMap.get(code);
    }

    public wasReleased(code: KECode): boolean {
        return this.keyReleasedMap.has(code) && this.keyReleasedMap.get(code);
    }


    /* 
    Sequence:
     Mousetrap.bind('up up down down left right left right b a enter'

    either of these will set off the function:
        Mousetrap.bind(['command+k', 'ctrl+k']

    multiple:
        Mousetrap.bind('command+shift+k'
    */

    // GET RID OF THIS FUNCTION. CALLBACKS HERE GET CALLED WHENEVER the JS Engine is available. Should be at specific poitns
    // always keyup because down and press will repeatadly fire
    // this is why I want polling so I dont have to deal with this
    public bind(keys: string | string[], callback: (e: ExtendedKeyboardEvent, combo: string) => any){
        this.mousetrap.bind(keys, callback,"keyup");
    }

    //same as onKeyPress but before
    public onKeyDown(keys: string, callback: (e: ExtendedKeyboardEvent, combo: string) => any){
        this.mousetrap.bind(keys, callback, 'keydown')
    }

    /*
    // calls it everytime that k character would be type if it was held down
    onKeyPress(keys: string, callback: (e: ExtendedKeyboardEvent, combo: string) => any){
        mousetrap_bind(keys, callback, 'keypress')
    }
    */
}

