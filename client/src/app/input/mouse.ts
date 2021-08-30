import { Vec2 } from "shared/shapes/vec2";
import { sign } from "shared/misc/mathutils";
import { Point } from "pixi.js";
import { BearEngine } from "../core-engine/bearengine";

export type MouseButton = "left" | "middle" | "right" 

export interface MouseInput {
    readonly position: Vec2,
    readonly x: number,
    readonly y: number,

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

export class EngineMouse {

    public engine: BearEngine;
    constructor(engine: BearEngine){
        this.engine = engine;
    }

    // Really far away so doesn't overlap with anyone at beginning
    position: Vec2 = new Vec2(-99999999,-99999999);
    screenPosition: Vec2 = new Vec2(-99999999,-99999999);
    velocity: Vec2 = new Vec2(0,0);
    scroll: number = 0;

    get x(){ return this.position.x }
    get y(){ return this.position.y }

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
    private _mousemove: ((worldPoint:Vec2,screenPoint:Vec2) => void)[] = [];
    private _mousedown: ((worldPoint:Vec2,screenPoint:Vec2) => void)[][] = [[],[],[]];
    private _mouseup: ((worldPoint:Vec2,screenPoint:Vec2) => void)[][] = [[],[],[]];
    private _onscroll: ((direction: number,worldPoint:Vec2,screenPoint:Vec2) => void)[] = [];

    init(){
        const renderer = this.engine.renderer;
        const targetWindow: Window = renderer.renderer.view.ownerDocument.defaultView;

        const setPositionFromEvent = (e: MouseEvent) => {
            this.screenPosition.x = e.x;
            this.screenPosition.y = e.y;

            // Transforms it into the space of 
            const canvasPoint = new Point();
            renderer.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.screenPosition.x,this.screenPosition.y);
            
            // @ts-expect-error
            renderer.mainContainer.toLocal(canvasPoint,undefined,this.position);
        }

        const pointermove = (e: MouseEvent) => {
            setPositionFromEvent(e);
            this._mousemove.forEach(element => {
                element(this.position, this.screenPosition);
            });
        }
        // Sets mouse positions
        targetWindow.addEventListener("pointermove", pointermove);
            
        // Zoom
        targetWindow.addEventListener("wheel", (e) => {
            const canvasPoint = new Point();
            renderer.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.screenPosition.x,this.screenPosition.y);
            // @ts-expect-error
            renderer.mainContainer.toLocal(canvasPoint,undefined,this.position);

            this.scroll = sign(e.deltaY);
            this.didScroll = true;

            this._onscroll.forEach((func) => {
                func(this.scroll, this.position, this.screenPosition);
            })
        })

        targetWindow.addEventListener("click", (e) => {
            this._click.forEach(element => {
                element(this.position, this.screenPosition);
            });
        })

        const pointer_down = (e: MouseEvent) => {
            setPositionFromEvent(e);
            const index = e.button;
            this._mousedown[index].forEach(element => {
                element(this.position, this.screenPosition);
            });

            // this is only called once unlike key presses
            this.down[index] = true;
        }
        targetWindow.addEventListener("pointerdown", pointer_down);

        const pointer_up = (e: MouseEvent) => {
            const index = e.button;
            this._mouseup[index].forEach(element => {
                element(this.position, this.screenPosition);
            });
            this.down[index] = false;
        }
        targetWindow.addEventListener("pointerup", pointer_up);

        targetWindow.addEventListener("blur", () => {
            this.down = [false, false, false];
        })
    }

    // run before update loop
    update(){
        // Set position of mouse
        const canvasPoint = new Point();
        const renderer = this.engine.renderer;
        renderer.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.screenPosition.x,this.screenPosition.y);
        // @ts-expect-error
        renderer.mainContainer.toLocal(canvasPoint,undefined,this.position);

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
    
    onscroll(func: (direction: number,worldPoint:Vec2,screenPoint:Vec2) => void){
        this._onscroll.push(func);
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
}



