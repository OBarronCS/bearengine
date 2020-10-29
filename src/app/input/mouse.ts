import { Vec2 } from "../math-library/shapes/vec2";
import { sign } from "../math-library/miscmath";

export type MouseButton = "left" | "middle" | "right" 

export interface MouseInput {
    readonly position: Vec2,
    readonly screenPosition: Vec2;
    // movement of mouse from last step to this step
    readonly velocity: Vec2;
    // Use it a bit and see if the sign should be automatically flipped
    /** Either -1, 0, or 1 to indicate how the direction of the current mouse scroll*/
    readonly scroll: number,


    isDown(button: MouseButton): boolean,
    wasPressed(button: MouseButton): boolean,
    wasReleased(button: MouseButton): boolean,

    onclick(func: (worldPoint:Vec2,screenPoint:Vec2) => void): void,
    onmousedown(_button:MouseButton, func: (worldPoint:Vec2,screenPoint:Vec2) => void): void;
    onmouseup(_button:MouseButton, func: (worldPoint:Vec2,screenPoint:Vec2) => void): void;
    onmousemove(func: (worldPoint:Vec2,screenPoint:Vec2) => void): void,
}

export interface EngineMouse extends MouseInput {
    update(): void;
    addWindowListeners(window: Window): void
}

export class InternalMouse implements EngineMouse {
    position: Vec2 = new Vec2(0,0);
    screenPosition: Vec2 = new Vec2(0,0);
    velocity: Vec2 = new Vec2(0,0);
    scroll: number = 0;

    private lastPosition = new Vec2(0,0);

    private didScroll = false;
    // holds buttons that were released since last tick
    private released: [boolean, boolean, boolean] = [false, false, false];

    // pressed since last tick
    private pressed:  [boolean, boolean, boolean] = [false, false, false]; 

    private lastDown: [boolean, boolean, boolean] = [false, false,false];
    // holds buttons that are currently being held down (true as long as still down)
    private down: [boolean, boolean, boolean] = [false, false,false];

    private stringToKey = {"left":0,"middle":1,"right":2}

    // click --> called once when left mouse button down and up
    private _click: ((worldPoint:Vec2,screenPoint:Vec2) => void)[] = [];
    private _mousemove:  ((worldPoint:Vec2,screenPoint:Vec2) => void)[] = [];
    private _mousedown:  ((worldPoint:Vec2,screenPoint:Vec2) => void)[][] = [[],[],[]];
    private _mouseup: ((worldPoint:Vec2,screenPoint:Vec2) => void)[][] = [[],[],[]];

    addWindowListeners(targetWindow: Window){
        targetWindow.addEventListener("wheel", (e) => {
            this.scroll = sign(e.deltaY);
            this.didScroll = true;
        })

        targetWindow.addEventListener("click", (e) => {
            this._click.forEach(element => {
                element(this.position, this.screenPosition);
            });
        })

        targetWindow.addEventListener("mousedown", (e) => {
            const index = e.button;
            this._mousedown[index].forEach(element => {
                element(this.position, this.screenPosition);
            });

            // this is only called onces unlike key presses
            this.down[index] = true;
        })

        targetWindow.addEventListener("mouseup", (e) => {
            const index = e.button;
            this._mouseup[index].forEach(element => {
                element(this.position, this.screenPosition);
            });
            this.down[index] = false;
        })

        targetWindow.addEventListener("mousemove", (e) => {

            this.screenPosition.x = e.x;
            this.screenPosition.y = e.y;
            
            this._mousemove.forEach(element => {
                element(this.position, this.screenPosition);
            });
        })
    }

    onclick(func: (worldPoint:Vec2,screenPoint:Vec2) => void){
        this._click.push(func)
    }
   
    onmousedown(_button:MouseButton, func: (worldPoint:Vec2,screenPoint:Vec2) => void){
        const index = this.stringToKey[_button];
        this._mousedown[index].push(func)
    }

    onmouseup(_button:MouseButton, func: (worldPoint:Vec2,screenPoint:Vec2) => void){
        const index = this.stringToKey[_button];
        this._mouseup[index].push(func)
    }

    onmousemove(func: (worldPoint:Vec2,screenPoint:Vec2) => void){
        this._mousemove.push(func)
    }


    isDown(_button:MouseButton): boolean{
        const index = this.stringToKey[_button];
        return this.down[index]
    }

    wasPressed(_button:MouseButton): boolean{
        const index = this.stringToKey[_button];
        return this.pressed[index]
    }

    wasReleased(_button:MouseButton): boolean{
        const index = this.stringToKey[_button];
        return this.released[index]
    }

    // run before update loop
    update(){
        // Position is set in engine right before this
        this.velocity.set({x: this.position.x - this.lastPosition.x, y: this.position.y - this.lastPosition.y}) 


        this.released = [false, false, false];
        this.pressed = [false, false, false];

        for(let key = 0; key < 3; key++){
            if(this.down[key]){
                if(!this.lastDown[key]){
                    this.pressed[key] = true
                }
            } else {
                if(this.lastDown[key]){
                    this.released[key] = true
                }
            }
        }
        ///@ts-ignore --> no elegent way to copy tuple without compiler complaining because it turns into an array
        this.lastDown = this.down.slice(0);

        // No scroll event for not scrolling so have to manually set it to zero
        if(!this.didScroll){
            this.scroll = 0;
        }

        this.didScroll = false;
        this.lastPosition.set(this.position);
    }

}



