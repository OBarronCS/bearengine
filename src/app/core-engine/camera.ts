import { Container, Point } from "pixi.js";
import { Renderer } from "./renderer";
import { Vec2 } from "../math-library/vec2";
import { E } from "./globals";

export class CameraSystem {
    
    // Top left of the camera in world coordinates
    position: Vec2

    public renderer: Renderer;
    public container: Container;
    public startPoint: any;

    constructor(renderer: Renderer, container: Container, targetWindow: Window) {
        this.position = new Vec2(0,0);
        this.renderer = renderer;
        this.container = container;

        E.Keyboard.bind("space", () => {
            this.renderer.mainContainer.pivot.x = -1300
            this.renderer.mainContainer.pivot.y = -100
            this.renderer.mainContainer.scale.x = .3;
            this.renderer.mainContainer.scale.y = .3;
        });
        
        // Dragging the layer around
        let startMouse: any;
        targetWindow.addEventListener("mousemove",event => {
            const point = new Point(0,0);
            renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(point, event.x, event.y)

            if(!E.Mouse.isDown("middle")){
                if(!E.Mouse.isDown("left")) return
                if(!E.Keyboard.isDown("ShiftLeft")) return
            } 
            

            const speed = 1;

            container.pivot.x = this.startPoint.x - (((point.x - startMouse.x) / container.scale.x) * speed)
            container.pivot.y = this.startPoint.y - (((point.y - startMouse.y) / container.scale.y) * speed) 
        })

        targetWindow.addEventListener("mousedown", (event) => {
            this.startPoint = this.container.pivot.copyTo(new Point(0,0));
            startMouse = renderer.mouse.clone()
        })

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

    // NOT IN USE
    // i have to think about this --> take in css x and y or renderer.mouse.x.y
    // renderer.mouse won't work in window.open...
    pixiGlobalToGamePoint(point: Point): Point{
        /* FROM css x and y (native mouse move event e.x,y) to WORLD X AND Y
         const canvasPoint = new PIXI.Point();
        this.renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(canvasPoint,this.mouse.screenPosition.x,this.mouse.screenPosition.y);
        /// @ts-ignore
        this.renderer.mainContainer.toLocal(canvasPoint,undefined,this.mouse.position);
        */
        const con = this.container;

        let gamePoint = con.toLocal(new Point(point.x, point.y))
        return gamePoint as Point;
    }
}

