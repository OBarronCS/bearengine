import { Text, Container, Point, TextStyle } from "shared/graphics/graphics";
import { Coordinate, mix, Vec2 } from "shared/shapes/vec2";
import { Rect } from "shared/shapes/rectangle";

import { RendererSystem } from "./renderer";
import { clamp, lerp, max, min } from "shared/misc/mathutils";
import { smoothNoise } from "shared/misc/random";
import { EngineMouse } from "../input/mouse";
import { BearEngine } from "./bearengine";
import { ease } from "shared/core/tween";

        
const MAX_ANGLE_SHAKE = 2; //degrees
const MAX_OFFSET_SHAKE = 14;

export class CameraSystem  {
    
    public engine: BearEngine;
    constructor(engine: BearEngine){
        this.engine = engine;
    }

    public container: Container;
    public renderer: RendererSystem;
    public mouse: EngineMouse;

    private center: Vec2 = new Vec2(0,0);
    
    private should_adjust_x = true;
    private should_adjust_y = true;
    private mode: "free" | "follow" = "free";
    get_mode(){
        return this.mode;
    }
    private targetMiddle: Vec2;
    
    
    private shakes: CameraShake[] = [];
    addShake(s: CameraShake){
        this.shakes.push(s);
    }


    private bounds: {min: Coordinate, max: Coordinate} = null;
    setBounds(x: {min: Coordinate, max: Coordinate}){
        this.bounds = x;

        const width_p = this.view_width / this.bounds.max.x;
        const height_p = this.view_height / this.bounds.max.y;

        const max_p = max(width_p, height_p);
        
        // console.log(width_p, height_p)

        if(width_p > 1 && height_p > 1){ //  max_p > 1
            // Container.scale messes with these equations, so this normalizes it... works!
            this.setZoom(1);

            const width_p = this.view_width / this.bounds.max.x;
            const height_p = this.view_height / this.bounds.max.y;

            this.setZoom(min(width_p, height_p));
            this.should_adjust_x = false;
            this.should_adjust_y = false;

            this.left = this.bounds.max.x / 2 - this.view_width / 2;
            this.top = this.bounds.max.y / 2 - this.view_height / 2;
        }

        // Otherwise if one is smaller and other is greater, clamp stop ONE axis from moving!

        if(width_p > 1){
            this.left = this.bounds.max.x / 2 - this.view_width / 2;
            this.should_adjust_x = false;

            console.log("stop x")
        }

        if(height_p > 1){
            this.top = this.bounds.max.y / 2 - this.view_height / 2;
            this.should_adjust_y = false;

            
            console.log("stop y")
        }

    }
    clearBounds(){
        this.bounds = null;
        this.should_adjust_x = true;
        this.should_adjust_y = true;
    }

    get zoom(){
        return this.container.scale.x;
    }

    public setZoom(factor: number){
        this.container.scale.set(factor);
    }


    setDangle(degrees: number){
        this.container.angle = degrees;
    }

    // I couldn't get this to work well so just reverted to original DOM events
    init(): void {

        const renderer = this.renderer = this.engine.renderer;
        const container = this.container = renderer.mainContainer;

        this.setPivot();

        this.renderer.onresize((e) => this.setPivot())


        const keyboard = this.engine.keyboard;
        const mouse = this.mouse = this.engine.mouse;

        const space = () => {
            this.renderer.mainContainer.scale.x = 1;
            this.renderer.mainContainer.scale.y = 1;

            this.left = -50;
            this.top = -50;
        }
        space();
        // keyboard.bind("space", space);

        // DRAGGING 

        let startMouse: Coordinate;
        let startPoint: Coordinate;

        // start drag
        window.addEventListener("pointerdown", (event) => {
            startPoint = this.center.clone();
            const point = new Point(0,0);
            renderer.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y);
            startMouse = point//renderer.mouse.clone()
        });

        // live pointers for a tick
        let pointer_event_cache: PointerEvent[] = [];
        let startMiddle: Coordinate = null;

        function addPointerCache(e: PointerEvent){
            for(let i = 0; i < pointer_event_cache.length; i++){
                if(e.pointerId === pointer_event_cache[i].pointerId) { 
                    pointer_event_cache.splice(i,1,e);
                    return;
                }
            }

            pointer_event_cache.push(e);
        }

        // while dragging
        window.addEventListener("pointermove",event => {
            const point = new Point(0,0);
            renderer.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y);

            const speed = 1;
            addPointerCache(event);
            // mouse    pen,    touch 

            if(event.pointerType === "mouse"){
                if(!mouse.isDown("middle")){
                    if(!mouse.isDown("left")) return;
                    if(!keyboard.isDown("ShiftLeft")) return;
                } 
                

                this.center.x = startPoint.x - (((point.x - startMouse.x) / container.scale.x) * speed)
                this.center.y = startPoint.y - (((point.y - startMouse.y) / container.scale.y) * speed) 
            } else {
                if(pointer_event_cache.length >= 2){
                    
                    let p1: Coordinate = new Vec2(pointer_event_cache[0].clientX,pointer_event_cache[0].clientY);
                    let p2: Coordinate = new Vec2(pointer_event_cache[1].clientX,pointer_event_cache[1].clientY);

                    const point = new Point(0,0);
                    renderer.renderer.plugins.interaction.mapPositionToPoint(point, p1.x, p1.y);
                    p1 = point;

                    const point2 = new Point(0,0);
                    renderer.renderer.plugins.interaction.mapPositionToPoint(point2, p2.x, p2.y);
                    p2 = point2;

                    const middle = mix(p1,p2,0.5);

                    if(startMiddle === null) 
                        startMiddle = middle.clone();
                    else {
                        this.center.x = startMiddle.x - (((middle.x - startMiddle.x) / container.scale.x) * speed);
                        this.center.y = startMiddle.y - (((middle.y - startMiddle.y) / container.scale.y) * speed);
                    }

                }
            }
        });

        // Lift finger
        window.addEventListener("pointerup", (e)=> {
            pointer_event_cache = [];
            startMiddle = null;
        })

        // ZOOM
        window.addEventListener("wheel", (event) => {
            const point = new Point(0,0);
            renderer.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y);
            const con = this.container;

            // makes it so the mousepoint stays the same after and before zoom
            const mousePoint = con.toLocal(new Point(point.x, point.y));

            con.scale.x += event.deltaY * -1 * .001
            con.scale.y += event.deltaY * -1 * .001
            if(con.scale.x < .05){
                con.scale.x = .05
                con.scale.y = .05
            }

            const newMousePoint = con.toLocal(new Point(point.x, point.y));

            if(this.mode === "free"){    
                this.center.x += mousePoint.x - newMousePoint.x
                this.center.y += mousePoint.y - newMousePoint.y
            }
        });
    }

    setPivot(){
        // pivot should be at center of screen at all times. Allows rotation around the middle
        this.container.position.x = this.renderer.renderer.width / 2;
        this.container.position.y = this.renderer.renderer.height / 2;
    }

    update(dt: number){

        const pivot = {x: this.center.x, y: this.center.y};

        this.container.pivot.copyFrom(pivot);

        if(this.bounds !== null){

            if(this.should_adjust_x){
                if(this.right > this.bounds.max.x) this.container.pivot.x = this.bounds.max.x - this.view_width / 2;
                if(this.left < this.bounds.min.x) this.container.pivot.x = this.view_width / 2;
            }

            if(this.should_adjust_y){
                if(this.bot > this.bounds.max.y) this.container.pivot.y = this.bounds.max.y - this.view_height / 2;
                if(this.top < this.bounds.min.y) this.container.pivot.y = this.view_height / 2;
            }
        }

        const d = new Vec2();

        for(const shake of this.shakes){
            if(shake.done) continue;
            shake.update(dt)
            d.add(shake.displacement);
        }

        this.container.pivot.x += d.x;
        this.container.pivot.y += d.y;

        //this.container.angle = this.baseDangle + shakeAngle;
        
        // apply shake AFTER clamping camera position
        // this.container.pivot.x += dx;
        // this.container.pivot.y += dy;

        const amount = .05;

        if(this.mode === "follow") {
            if(this.should_adjust_x){
                this.center.x = lerp(this.center.x, this.targetMiddle.x, amount);
            }

            if(this.should_adjust_y) {
                this.center.y = lerp(this.center.y, this.targetMiddle.y, amount);
            }
        }
    }

    set left(x: number) { this.center.x = x + (this.container.position.x / this.container.scale.x); }
    get left(): number { return this.center.x - (this.container.position.x / this.container.scale.x); }

    set right(x: number) { this.center.x = x - (this.container.position.x / this.container.scale.x); }
    get right(): number { return this.center.x + (this.container.position.x / this.container.scale.x); }

    set top(y: number) { this.center.y = y + (this.container.position.y / this.container.scale.y); }
    get top(): number { return this.center.y - (this.container.position.y / this.container.scale.y); }

    set bot(y: number) { this.center.y = y - (this.container.position.y / this.container.scale.y); }
    get bot(): number { return this.center.y + (this.container.position.y / this.container.scale.y); }

    // Takes into account zoom. How many pixels are being shown on screen
    get view_width(){ return 2 * this.container.position.x / this.container.scale.x; }
    get view_height(){ return 2 * this.container.position.y / this.container.scale.y; }


    follow(vec: Vec2){
        this.targetMiddle = vec;
        this.mode = "follow";
    }

    free(){
        this.mode = "free"
        this.clearBounds();
    }

    inView(point: Coordinate){
        return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bot;
    }

    getViewBounds(){
        return new Rect(this.left, this.top, this.view_width, this.view_height);
    }
}


//Screen shake

interface CameraShake {
    
    displacement: Vec2;

    done: boolean;

    update(dt: number): void;
}

export class SmoothShake implements CameraShake {
    displacement: Vec2 = new Vec2();
    done: boolean = false;


    // Used for camera shake [0,1]

    constructor(private trauma: number){}

    update(dt: number): void {

        const seed = Date.now();
        
        const shake = this.trauma**3;

        const shakeAngle = MAX_ANGLE_SHAKE * shake * smoothNoise(seed);
        const dx = MAX_OFFSET_SHAKE * shake * smoothNoise(seed + 1000);
        const dy = MAX_OFFSET_SHAKE * shake * smoothNoise(seed + 2000);

        this.displacement.x = dx;
        this.displacement.y = dy;

        this.trauma -= .007;
        if(this.trauma < 0) { 
            this.trauma = 0;
            this.done = true;
        }
    }


    addTrauma(n: number){
        this.trauma = clamp(this.trauma + n,0,1);
    }

    
}


export class RecoilShake implements CameraShake {

    displacement: Vec2 = new Vec2();
    done: boolean = false;
    
    target: Vec2;
    
    t = 0;
    duration = .1;

    constructor(public direction: Vec2){
        this.target = direction.clone().normalize().extend(10);
    }

    update(dt: number): void {
        this.t += dt / this.duration;
        if(this.t < 1){
            this.displacement = mix(Vec2.ZERO, this.target, ease(this.t));
        } else if(this.t < 2){
            this.displacement = mix(this.target, Vec2.ZERO, ease(this.t - 1));
        } else {
            this.done = true;
        }
    }
}

