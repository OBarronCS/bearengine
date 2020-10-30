import { Container, Point } from "pixi.js";
import { Renderer } from "./renderer";
import { Coordinate, Vec2 } from "../math-library/shapes/vec2";
import { E } from "./globals";
import { Rect } from "../math-library/shapes/rectangle";

export class CameraSystem {
    
    public renderer: Renderer;
    public container: Container;

    constructor(renderer: Renderer, container: Container, targetWindow: Window) {

        this.renderer = renderer;
        this.container = container;

        // pivot should be at center of screen at all times. Allows rotation around the middle
        // set it to half the renderer width
        container.position.x = renderer.pixiapp.renderer.width / 2;
        container.position.y = renderer.pixiapp.renderer.height / 2;



        E.Keyboard.bind("space", () => {
            this.center = {x: 500, y:500}
            this.renderer.mainContainer.scale.x = .4;
            this.renderer.mainContainer.scale.y = .4;
        });

        
        // Dragging the layer around
        let startMouse: Coordinate;
        let startPoint: Coordinate;
        targetWindow.addEventListener("mousemove",event => {
            const point = new Point(0,0);
            renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y)

            if(!E.Mouse.isDown("middle")){
                if(!E.Mouse.isDown("left")) return
                if(!E.Keyboard.isDown("ShiftLeft")) return
            } 

            const speed = 1;

            container.pivot.x = startPoint.x - (((point.x - startMouse.x) / container.scale.x) * speed)
            container.pivot.y = startPoint.y - (((point.y - startMouse.y) / container.scale.y) * speed) 
        })

        targetWindow.addEventListener("mousedown", (event) => {
            startPoint = this.container.pivot.copyTo(new Point(0,0));
            startMouse = renderer.mouse.clone()
        })

        // ZOOM
        targetWindow.addEventListener("wheel", (event) => {
            const point = new Point(0,0);
            renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y)
            const con = this.container;

            // makes it so the mousepoint stays the same after and before zoom
            let mousePoint = con.toLocal(new Point(point.x, point.y));

            con.scale.x += event.deltaY * -1 * .001
            con.scale.y += event.deltaY * -1 * .001
            if(con.scale.x < .05){
                con.scale.x = .05
                con.scale.y = .05
            }

            let newMousePoint = con.toLocal(new Point(point.x, point.y));

            con.pivot.x += mousePoint.x - newMousePoint.x
            con.pivot.y += mousePoint.y - newMousePoint.y
            
        })
    }


    set center(point: Coordinate) { this.container.pivot.copyFrom(point); }
    get center(): Coordinate { return this.container.pivot }

    set left(x: number) { this.container.pivot.x = x + (this.container.position.x / this.container.scale.x); }
    get left(): number {return this.container.pivot.x - (this.container.position.x / this.container.scale.x); }

    set right(x: number) { this.container.pivot.x = x - (this.container.position.x / this.container.scale.x); }
    get right(): number {return this.container.pivot.x + (this.container.position.x / this.container.scale.x); }

    set top(y: number) { this.container.pivot.y = y + (this.container.position.y / this.container.scale.y); }
    get top(): number { return this.container.pivot.y - (this.container.position.y / this.container.scale.y); }

    set bot(y: number) { this.container.pivot.y = y - (this.container.position.y / this.container.scale.y); }
    get bot(): number { return this.container.pivot.y + (this.container.position.y / this.container.scale.y); }


    // Takes into account zoom. How many pixels are being rendered
    get viewWidth(){ return 2 * this.container.position.x / this.container.scale.x; }
    get viewHeight(){ return 2 * this.container.position.y / this.container.scale.y; }


    // checks whether a point is in the view
    inView(point: Coordinate){
        return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bot;
    }

    getViewBounds(){
        return new Rect(this.left, this.top, this.viewWidth, this.viewHeight);
    }
}

