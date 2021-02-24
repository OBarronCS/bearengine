import { Text, Container, Point, TextStyle } from "pixi.js";
import { Coordinate, mix, Vec2 } from "shared/shapes/vec2";
import { Rect } from "shared/shapes/rectangle";

import { RendererSystem } from "./renderer";
import { EngineKeyboard } from "../input/keyboard";
import { lerp, round, smoothNoise } from "shared/miscmath";
import { BearEngine } from "./bearengine";
import { Subsystem } from "shared/core/subsystem";
import { EngineMouse } from "../input/mouse";

export class CameraSystem extends Subsystem {
    
    public container: Container;
    public renderer: RendererSystem;
    public mouse: EngineMouse;
    

    public targetMiddle: Vec2;
    public mode: "free" | "follow" = "free"

    // Used for camera shake [0,1]
    private trauma = 0;

    private mouse_info = new Text("",new TextStyle({"fill": "white"}));
    

    // I couldn't get this to work well so just reverted to original DOM events
    init(): void {
        const renderer = this.renderer = this.getSystem(RendererSystem);

        this.mouse_info.x = 5;
        this.mouse_info.y = renderer.getPercentHeight(1) - 50;
        renderer.addGUI(this.mouse_info);

        const container = this.container = renderer.mainContainer;

        // pivot should be at center of screen at all times. Allows rotation around the middle
        container.position.x = renderer.renderer.width / 2;
        container.position.y = renderer.renderer.height / 2;

        const keyboard = this.getSystem(EngineKeyboard);
        const mouse = this.mouse = this.getSystem(EngineMouse);
        keyboard.bind("h", () => {
            this.trauma = .5;
        });

        keyboard.bind("space", () => {
            this.center.set({x: 500, y:500});
            this.renderer.mainContainer.scale.x = 1;
            this.renderer.mainContainer.scale.y = 1;
        });

        // Dragging the layer around
        let startMouse: Coordinate;
        let startPoint: Coordinate;

        // start drag
        window.addEventListener("mousedown", (event) => {
            startPoint = this.center.clone();
            const point = new Point(0,0);
            renderer.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y);
            startMouse = point//renderer.mouse.clone()
        });

        // while dragging
        window.addEventListener("mousemove",event => {
            const point = new Point(0,0);
            renderer.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y);

            if(!mouse.isDown("middle")){
                if(!mouse.isDown("left")) return;
                if(!keyboard.isDown("ShiftLeft")) return;
            } 

            const speed = 1;

            this.center.x = startPoint.x - (((point.x - startMouse.x) / container.scale.x) * speed)
            this.center.y = startPoint.y - (((point.y - startMouse.y) / container.scale.y) * speed) 
        });

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

            this.center.x += mousePoint.x - newMousePoint.x
            this.center.y += mousePoint.y - newMousePoint.y
        });
    }

    update(delta: number){
        this.mouse_info.text = `${round(this.mouse.position.x, 1)},${round( this.mouse.position.y, 1)}`;

        const maxAngle = 20;
        const maxOffset = 40;
        
        const seed = Date.now();

        const shake =  (this.trauma**2);

        const shakeAngle = maxAngle * shake * smoothNoise(seed);
        const dx = maxOffset * shake * smoothNoise(seed + 1000);
        const dy = maxOffset * shake * smoothNoise(seed + 2000);

        // shake is actually broken. It rotates around the position, which is not center of screen
        this.container.angle = this.baseDangle + shakeAngle;
        this.container.pivot.copyFrom({x: this.center.x + dx,y: this.center.y + dy});

        this.trauma -= .007;
        if(this.trauma < 0) this.trauma = 0;
        if(this.mode === "follow") this.center = mix(this.center, this.targetMiddle, .40);
    }
    
    public zoom(factor: Coordinate){
        this.container.scale.copyFrom(factor);
    }

    private center: Vec2 = new Vec2(0,0);

    set left(x: number) { this.container.pivot.x = x + (this.container.position.x / this.container.scale.x); }
    get left(): number { return this.container.pivot.x - (this.container.position.x / this.container.scale.x); }

    set right(x: number) { this.container.pivot.x = x - (this.container.position.x / this.container.scale.x); }
    get right(): number { return this.container.pivot.x + (this.container.position.x / this.container.scale.x); }

    set top(y: number) { this.container.pivot.y = y + (this.container.position.y / this.container.scale.y); }
    get top(): number { return this.container.pivot.y - (this.container.position.y / this.container.scale.y); }

    set bot(y: number) { this.container.pivot.y = y - (this.container.position.y / this.container.scale.y); }
    get bot(): number { return this.container.pivot.y + (this.container.position.y / this.container.scale.y); }

    // Takes into account zoom. How many pixels are being shown on screen
    get viewWidth(){ return 2 * this.container.position.x / this.container.scale.x; }
    get viewHeight(){ return 2 * this.container.position.y / this.container.scale.y; }

    // base degree angle
    private baseDangle = 0;

    follow(vec: Vec2){
        this.targetMiddle = vec;
        this.mode = "follow";
    }

    
    

    inView(point: Coordinate){
        return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bot;
    }

    getViewBounds(){
        return new Rect(this.left, this.top, this.viewWidth, this.viewHeight);
    }
}


