
import { BaseTexture, Graphics, Sprite, Texture } from "pixi.js";

import { Tilemap } from "shared/datastructures/tilemap";
import { rgb, Color } from "shared/datastructures/color";
import { DynamicAABBTree } from "shared/datastructures/dynaabbtree";
import { GraphNode, LiveGridGraph } from "shared/datastructures/graphs";
import { SparseGrid } from "shared/datastructures/hashtable";
import { HermiteCurve } from "shared/datastructures/paths";
import { GridQuadNode, GridQuadTree, LiveGridQuadTree, QuadTree } from "shared/datastructures/quadtree";
import { chance, fillFunction, random, randomInt, randomRangeSet, random_range } from "shared/misc/random";
import { Ellipse } from "shared/shapes/ellipse";
import { Line } from "shared/shapes/line";
import { Polygon } from "shared/shapes/polygon";
import { Rect, dimensions } from "shared/shapes/rectangle";
import { drawCircle, drawLineArray, drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Vec2, Coordinate, angleBetween, mix } from "shared/shapes/vec2";
import { atan2, cos, floor, PI, second, sin } from "shared/misc/mathutils";
import { ColorTween } from "shared/core/tween"
import { TickTimer } from "shared/datastructures/ticktimer"
import { ColliderPart } from "shared/core/entityattribute";
import { bearevent } from "shared/core/bearevents";

import { DrawableEntity, Entity, GMEntity, SpriteEntity } from "../core-engine/entity";
import { Player } from "./player";
import { SpritePart } from "../core-engine/parts";
import { EntityID } from "shared/core/abstractentity";
import { BearEngine } from "../core-engine/bearengine";
import { GUI } from "dat.gui";
import { BearGame } from "shared/core/abstractengine";
import { DefaultEntityRenderer } from "../core-engine/renderer";

class BasicSprite extends SpriteEntity {

    constructor(){
        super(Vec2.ZERO,"flower.png")
    }

    draw(g: Graphics): void {}
    update(dt: number): void {}
}

export interface PlayerAnimation {
    frameData: PlayerAnimationFrame[];
    originX: number
    originY: number
}

interface PlayerAnimationFrame {
    frame: number;
    
    head: BodyPartFrameInfo;
    body: BodyPartFrameInfo;
        
    leftHand: BodyPartFrameInfo;
    rightHand: BodyPartFrameInfo;

    leftFoot: BodyPartFrameInfo;
    rightFoot: BodyPartFrameInfo;
}

interface BodyPartFrameInfo {
    canvas: PixelArtCanvas;
    relativeX: number
    relativeY: number
}

//#region Save Format  
export interface SavePlayerAnimation {
    frameData: SavePlayerAnimationFrame[];
    originX: number
    originY: number
}

interface SavePlayerAnimationFrame {
    frame: number;
    
    head: SaveBodyPartFrameInfo;
    body: SaveBodyPartFrameInfo;
        
    leftHand: SaveBodyPartFrameInfo;
    rightHand: SaveBodyPartFrameInfo;

    leftFoot: SaveBodyPartFrameInfo;
    rightFoot: SaveBodyPartFrameInfo;
}

interface SaveBodyPartFrameInfo {
    canvas: ReturnType<PixelArtCanvas["saveableVersion"]>;
    relativeX: number
    relativeY: number
}
//#endregion

class EmptyEntity extends Entity {

    // public tag = this.addPart(new ColliderPart(dimensions(50,50), Vec2.ZERO));
    // public position = new Vec2(randomInt(0, 1000), randomInt(0,1500));

    update(dt: number): void {

    }
}

export function frameEditor(engine: BearEngine): void {
    
    engine.renderer.setBackgroundColor(rgb(22, 30, 80));

    const scene = null //engine.entityManager;

    class DraggableEntity extends DrawableEntity {
            
        public sprite: SpritePart;

        constructor(path: string){
            super();
            this.sprite = this.addPart(new SpritePart(path));

            const pixi = this.sprite.sprite;
            pixi.interactive = true;

            let offset: Vec2 = new Vec2(0,0);

            let dragging = false;
    
            pixi.addListener("mousedown", (event) => {
                dragging = true;
                const pos = event.data.getLocalPosition(pixi.parent);
                offset.x = this.position.x - pos.x;
                offset.y = this.position.y - pos.y; 
            });
    
            pixi.addListener("mouseup", (e)=> {
                dragging = false;
            })

            pixi.addListener("mouseupoutside", (e)=> {
                dragging = false;
            })

            // while dragging
            pixi.addListener("mousemove",event => {
                if(!dragging) return;
                const pos = event.data.getLocalPosition(pixi.parent);
                this.position.x = pos.x + offset.x
                this.position.y = pos.y + offset.x
            });      
        }
        
        update(dt: number): void {
            this.redraw();
        }

        draw(g: Graphics): void {
            g.beginFill(0xFF0000)
            g.drawCircle(this.x, this.y, 3)
        }
    }

    

    class PlayerAnimator extends Entity {
        // What we are drawing on
        private sprite: SpritePart;
        private canvas = new PixelArtCanvas(80,80);
        private scale = 20;

        private lines = new Graphics();


        private preview: Sprite;
        private gui: GUI



        // Final data to be exported
        private animationData: PlayerAnimation = {
            frameData: [],
            originX: 0,
            originY: 0
        }

        // The frame we are currently working on
        private currentWorkingFrame = 0;
        private selectedBodyPart: "head" | "body" | "leftFoot" | "rightFoot" | "leftHand" | "rightHand";


        // Where we can click
        private highlightSelectedPart = new Graphics();
        private bodyPartGraphics = new Graphics()
        private workingFrameGraphics = new Graphics();

        constructor(){
            super();

            const spr = new Sprite(this.canvas.texture);
            this.preview = new Sprite(this.canvas.texture);

            this.sprite = this.addPart(new SpritePart(spr));
            this.sprite.scale = {x: this.scale,y:this.scale}


            this.lines.lineStyle(3,0x000000);
            this.lines.zIndex = 1000;
            for(let i = 0; i < this.canvas.width; i++){
                this.lines.moveTo(i * this.scale, 0);
                this.lines.lineTo(i * this.scale, this.canvas.height * this.scale);
            }
            
            for(let j = 0; j < this.canvas.height; j++){
                this.lines.moveTo(0,j * this.scale);
                this.lines.lineTo(this.canvas.width * this.scale, j  * this.scale);
            }


            this.startNewFrame();

            
            this.gui = new GUI();
            this.gui.add(this,"currentWorkingFrame");
            this.gui.add(this, "editHead")
            this.gui.add(this, "editBody")
            this.gui.add(this, "editLeftHand")
            this.gui.add(this, "editRightHand")
            this.gui.add(this, "editLeftFoot")
            this.gui.add(this, "editRightFoot")

            this.gui.add(this, "startNewFrame")
            this.gui.add(this, "save");
            this.gui.add(this, "startEditingFromFilePrompt");
        }

        private startEditingFromFilePrompt(){
            const data = prompt("Info");
            this.startEditingSavedData(data);
        }

         // Assume you call this first thing, 
        private startEditingSavedData(dataAsString: string){
            this.animationData.frameData = [];
            
            const animation = JSON.parse(dataAsString);
        
            const frameData = animation.frameData;
        
            for(const frame of frameData){

                this.animationData.frameData.push({
                    frame: frame.frame,
                    body: {
                        canvas: PixelArtCanvas.fromSave(frame.body.canvas),
                        relativeX: frame.body.relativeX,
                        relativeY: frame.body.relativeY,
                    },
                    head: {
                        canvas: PixelArtCanvas.fromSave(frame.head.canvas),
                        relativeX: frame.head.relativeX,
                        relativeY: frame.head.relativeY,
                    },
                    leftFoot: {
                        canvas: PixelArtCanvas.fromSave(frame.leftFoot.canvas),
                        relativeX: frame.leftFoot.relativeX,
                        relativeY: frame.leftFoot.relativeY,
                    },
                    leftHand: {
                        canvas: PixelArtCanvas.fromSave(frame.leftHand.canvas),
                        relativeX: frame.leftHand.relativeX,
                        relativeY: frame.leftHand.relativeY,
                    },
                    rightFoot: {
                        canvas: PixelArtCanvas.fromSave(frame.rightFoot.canvas),
                        relativeX: frame.rightFoot.relativeX,
                        relativeY: frame.rightFoot.relativeY,
                    },  
                    rightHand: {
                        canvas: PixelArtCanvas.fromSave(frame.rightHand.canvas),
                        relativeX: frame.rightHand.relativeX,
                        relativeY: frame.rightHand.relativeY,
                    },
                })
            }

            this.redraw();
        }

        // Called to select a part
        private editPart(part: "head" | "body" | "leftHand" | "rightHand" | "leftFoot" | "rightFoot" ){
            const frame = this.animationData.frameData[this.currentWorkingFrame];
            if(frame[part] === null){
                const answer = prompt("Size");
                if(answer === undefined || answer === null) return alert("Undefined");

                const size = answer.split(" ");
                const width = Number(size[0]);
                const height = Number(size[1]);

                if(width === undefined || height === undefined) return alert("Undefined")

                if(width > this.canvas.width) return alert("Too wide")
                if(height > this.canvas.height) return alert("Too tall")

                const sub = new PixelArtCanvas(width,height);
                frame[part] = {
                    canvas : sub,
                    relativeX : 0,
                    relativeY : 0,
                }
            } else if (this.selectedBodyPart === part){
                // If already editing this, offer to resize

                const answer = prompt("Resize, must be larger");
                if(answer === undefined || answer === null) return alert("Undefined");

                if(answer === "delete") {
                    frame[part] = null;
                    this.selectedBodyPart = undefined;
                    this.redraw();
                    return;
                }

                const size = answer.split(" ");
                const width = Number(size[0]);
                const height = Number(size[1]);

                if(width === undefined || height === undefined) return alert("Undefined")

                if(width < frame[part].canvas.width) return alert("Must be wider")
                if(height < frame[part].canvas.height) return alert("Must be wider")

                if(width > this.canvas.width) return alert("Too wide");
                if(height > this.canvas.height) return alert("Too tall");

                const sub = new PixelArtCanvas(width,height);
                sub.setSubCanvas(frame[part].canvas, 0, 0);
                frame[part] = {
                    canvas : sub,
                    relativeX : frame[part].relativeX,
                    relativeY : frame[part].relativeY,
                }
            }
            this.selectedBodyPart = part;
            this.redraw();
        }

        private editHead(){
            this.editPart("head");
        }

        private editBody(){
            this.editPart("body");
        }

        private editLeftHand(){
            this.editPart("leftHand");
        }

        private editRightHand(){
            this.editPart("rightHand");
        }

        private editLeftFoot(){
            this.editPart("leftFoot");
        }

        private editRightFoot(){
            this.editPart("rightFoot")          
        }

        override onAdd(){
            this.engine.renderer.addSprite(this.lines);

            this.preview.y = -this.canvas.height;

            const g = new Graphics();
            g.lineStyle(1, 0xFFFFFF)
            g.drawRect(0, 0, this.canvas.width, this.canvas.height)
            this.preview.addChild(g)

            this.engine.renderer.addSprite(this.preview);

            this.workingFrameGraphics.x = -200;
            this.engine.renderer.addSprite(this.workingFrameGraphics);
            this.bodyPartGraphics.x = this.canvas.width * this.scale
            this.engine.renderer.addSprite(this.bodyPartGraphics);
            this.engine.renderer.addSprite(this.highlightSelectedPart);
        }
        override onDestroy(){
            this.engine.renderer.removeSprite(this.lines);
            this.engine.renderer.removeSprite(this.preview);
            this.engine.renderer.removeSprite(this.workingFrameGraphics);
            this.engine.renderer.removeSprite(this.bodyPartGraphics);
            this.engine.renderer.removeSprite(this.highlightSelectedPart);
        }

        private switchToFrame(frame: number){
            this.currentWorkingFrame = frame;
            this.selectedBodyPart = undefined;
            this.redraw();
        }

        private startNewFrame(){
            // Copies everything from the frame before it;

            this.currentWorkingFrame = this.animationData.frameData.length;

            let data: PlayerAnimationFrame;
            if(this.currentWorkingFrame === 0){
                data = {
                    frame: this.currentWorkingFrame,
                    body: null,
                    head: null,
                    leftFoot: null,
                    leftHand: null,
                    rightFoot: null,
                    rightHand: null,
                }
            } else {

                if(!this.validateFrame(this.currentWorkingFrame - 1)) { 
                    this.currentWorkingFrame = this.animationData.frameData.length - 1;
                    return alert("Last frame not complete");
                }

                const lastFrame = this.animationData.frameData[this.currentWorkingFrame - 1];
                data = {
                    frame: this.currentWorkingFrame,
                    body: {
                        canvas:lastFrame.body.canvas.clone(),
                        relativeX:lastFrame.body.relativeX,
                        relativeY:lastFrame.body.relativeY,
                    },
                    head: {
                        canvas:lastFrame.head.canvas.clone(),
                        relativeX:lastFrame.head.relativeX,
                        relativeY:lastFrame.head.relativeY,
                    },
                    leftFoot: {
                        canvas:lastFrame.leftFoot.canvas.clone(),
                        relativeX:lastFrame.leftFoot.relativeX,
                        relativeY:lastFrame.leftFoot.relativeY,
                    },
                    leftHand:{
                        canvas:lastFrame.leftHand.canvas.clone(),
                        relativeX:lastFrame.leftHand.relativeX,
                        relativeY:lastFrame.leftHand.relativeY,
                    },
                    rightFoot: {
                        canvas:lastFrame.rightFoot.canvas.clone(),
                        relativeX:lastFrame.rightFoot.relativeX,
                        relativeY:lastFrame.rightFoot.relativeY,
                    },
                    rightHand: {
                        canvas:lastFrame.rightHand.canvas.clone(),
                        relativeX:lastFrame.rightHand.relativeX,
                        relativeY:lastFrame.rightHand.relativeY,
                    },
                }
            }
            this.selectedBodyPart = undefined;
            this.animationData.frameData.push(data);
            this.redraw();
        }

        private validateFrame(frameNumber: number): boolean {
            const frame = this.animationData.frameData[frameNumber];
            if(frame.head === null ||
                frame.body === null ||
                frame.leftHand === null ||
                frame.rightHand === null ||
                frame.leftFoot === null ||
                frame.rightFoot === null){
                    return false;
            }
            
            return true;
        }

        /** Returns JSON Stringified version of the data, so can be stored */
        save(): string {
            // Validation, fail if any null data
            for(let i = 0; i < this.animationData.frameData.length; i++){
                if(!this.validateFrame(i)) {
                    alert("Null body data on frame " + i);
                    return null;
                }
            }

            const frameData = this.animationData.frameData.map((value) => {
                return {
                    frame: value.frame,
                    // Pretty huge export size even for simple data
                    body: {
                        canvas: value.body.canvas.saveableVersion(),
                        relativeX: value.body.relativeX,
                        relativeY: value.body.relativeY
                    },
                    head: {
                        canvas: value.head.canvas.saveableVersion(),
                        relativeX: value.head.relativeX,
                        relativeY: value.head.relativeY
                    },
                    leftFoot: {
                        canvas: value.leftFoot.canvas.saveableVersion(),
                        relativeX: value.leftFoot.relativeX,
                        relativeY: value.leftFoot.relativeY
                    },
                    leftHand: {
                        canvas: value.leftHand.canvas.saveableVersion(),
                        relativeX: value.leftHand.relativeX,
                        relativeY: value.leftHand.relativeY
                    },
                    rightFoot: {
                        canvas: value.rightFoot.canvas.saveableVersion(),
                        relativeX: value.rightFoot.relativeX,
                        relativeY: value.rightFoot.relativeY
                    },
                    rightHand: {
                        canvas: value.rightHand.canvas.saveableVersion(),
                        relativeX: value.rightHand.relativeX,
                        relativeY: value.rightHand.relativeY
                    }

                }
            })
            

            const saved = {
                originX:0,
                originY:0,
                frameData: frameData
            };

            const str = JSON.stringify(saved)
            console.log(str)

            return str;
        }

       

        update(dt: number): void {
            this.redrawUI();

            const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
            // console.log(currentFrame)
            if(this.selectedBodyPart !== undefined){
                const selectedCanvas = currentFrame[this.selectedBodyPart];

                const left = selectedCanvas.relativeX * this.scale;
                const top = selectedCanvas.relativeY * this.scale;

                const rect = new Rect(left, top, selectedCanvas.canvas.width * this.scale, selectedCanvas.canvas.height * this.scale); 

                // Draw to THAT canvas
                if(rect.contains(this.mouse.position)){
                    if(this.mouse.isDown("left")){
                        const mouse = this.mouse.position;

                        const R = 0;
                        const G = 0;
                        const B = 0;
                        const A = 255;

                        selectedCanvas.canvas.setPixel(floor((mouse.x - left) / this.scale), floor((mouse.y - top) / this.scale), R, G, B, A);
                        this.redraw();
                    } else if(this.mouse.isDown("right")){
                        const mouse = this.mouse.position.clone().floor();
                        selectedCanvas.canvas.setPixel(floor((mouse.x - left) / this.scale), floor((mouse.y - top) / this.scale), 0, 0, 0, 0);
                        this.redraw();
                    }
                }

                const keyboard = this.keyboard.isDown("ShiftLeft") ? this.simpleKeyboardPressedCheck() : this.simpleKeyboardCheck()
                selectedCanvas.relativeX += keyboard.x;
                selectedCanvas.relativeY += keyboard.y;

                if(keyboard.x !== 0 || keyboard.y !== 0) this.redraw();
            }

            if(this.mouse.wasReleased("left")){
                for(let i = 0; i < this.animationData.frameData.length; i++){
                    if(this.mouse.x > -200 && this.mouse.x < 0 && this.mouse.y > i * 100 && this.mouse.y < i * 100 + 99) {
                        this.switchToFrame(i);
                    }                    
                }
            }
        }

        private redrawUI(){
            this.workingFrameGraphics.clear();

            for(let i = 0; i < this.animationData.frameData.length; i++){
                if(i === this.currentWorkingFrame) this.workingFrameGraphics.beginFill(0xFFFFF0)
                else this.workingFrameGraphics.lineStyle(3, 0xFFFFFF)

                if(this.mouse.x > -200 && this.mouse.x < 0 && this.mouse.y > i * 100 && this.mouse.y < i * 100 + 99) this.workingFrameGraphics.beginFill(0x00FFF0)
                this.workingFrameGraphics.drawRect(0, i * 100, 200, 100);
                this.workingFrameGraphics.endFill()
            }

            

            this.bodyPartGraphics.clear();

            const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
            
            //#region 
            let i = 0;
            if(currentFrame.head !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            i++

            if(currentFrame.body !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            i++
           

            if(currentFrame.leftHand !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            i++

            if(currentFrame.rightHand !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            i++

            if(currentFrame.leftFoot !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            i++

            if(currentFrame.rightFoot !== null){
                this.bodyPartGraphics.beginFill(0x00FF00);
                this.bodyPartGraphics.drawRect(0,i * 200,200,200);
                this.bodyPartGraphics.endFill();
            }
            //#endregion

            this.highlightSelectedPart.clear();
            if(this.selectedBodyPart !== undefined){
                this.highlightSelectedPart.beginFill(0x00FF00, .2)

                const selectedCanvas = currentFrame[this.selectedBodyPart];

                this.highlightSelectedPart.drawRect(selectedCanvas.relativeX * this.scale, selectedCanvas.relativeY * this.scale, selectedCanvas.canvas.width * this.scale, selectedCanvas.canvas.height * this.scale)
            }
        }

        private redraw(){
            const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
            this.canvas.clear();

            if(currentFrame.head !== null){
                this.canvas.setSubCanvas(currentFrame.head.canvas, currentFrame.head.relativeX, currentFrame.head.relativeY)
            }

            if(currentFrame.body !== null){
                this.canvas.setSubCanvas(currentFrame.body.canvas, currentFrame.body.relativeX, currentFrame.body.relativeY)
            }
            
            if(currentFrame.leftHand !== null){
                this.canvas.setSubCanvas(currentFrame.leftHand.canvas, currentFrame.leftHand.relativeX, currentFrame.leftHand.relativeY)
            }

            if(currentFrame.rightHand !== null){
                this.canvas.setSubCanvas(currentFrame.rightHand.canvas, currentFrame.rightHand.relativeX, currentFrame.rightHand.relativeY)
            }

            if(currentFrame.leftFoot !== null){
                this.canvas.setSubCanvas(currentFrame.leftFoot.canvas, currentFrame.leftFoot.relativeX, currentFrame.leftFoot.relativeY)
            }

            if(currentFrame.rightFoot !== null){
                this.canvas.setSubCanvas(currentFrame.rightFoot.canvas, currentFrame.rightFoot.relativeX, currentFrame.rightFoot.relativeY)
            }
        }
    }

    scene.addEntity(new PlayerAnimator());
}


//#region Frame editor classes
class DraggableEntity extends DrawableEntity {
            
    public sprite: SpritePart;

    constructor(path: string){
        super();
        this.sprite = this.addPart(new SpritePart(path));

        const pixi = this.sprite.sprite;
        pixi.interactive = true;

        let offset: Vec2 = new Vec2(0,0);

        let dragging = false;

        pixi.addListener("mousedown", (event) => {
            dragging = true;
            const pos = event.data.getLocalPosition(pixi.parent);
            offset.x = this.position.x - pos.x;
            offset.y = this.position.y - pos.y; 
        });

        pixi.addListener("mouseup", (e)=> {
            dragging = false;
        })

        pixi.addListener("mouseupoutside", (e)=> {
            dragging = false;
        })

        // while dragging
        pixi.addListener("mousemove",event => {
            if(!dragging) return;
            const pos = event.data.getLocalPosition(pixi.parent);
            this.position.x = pos.x + offset.x
            this.position.y = pos.y + offset.x
        });      
    }
    
    update(dt: number): void {
        this.redraw();
    }

    draw(g: Graphics): void {
        g.beginFill(0xFF0000)
        g.drawCircle(this.x, this.y, 3)
    }
}

class PlayerAnimator extends Entity {
    // What we are drawing on
    private sprite: SpritePart;
    private canvas = new PixelArtCanvas(80,80);
    private scale = 20;

    private lines = new Graphics();


    private preview: Sprite;
    private gui: GUI



    // Final data to be exported
    private animationData: PlayerAnimation = {
        frameData: [],
        originX: 0,
        originY: 0
    }

    // The frame we are currently working on
    private currentWorkingFrame = 0;
    private selectedBodyPart: "head" | "body" | "leftFoot" | "rightFoot" | "leftHand" | "rightHand";


    // Where we can click
    private highlightSelectedPart = new Graphics();
    private bodyPartGraphics = new Graphics()
    private workingFrameGraphics = new Graphics();

    constructor(){
        super();

        const spr = new Sprite(this.canvas.texture);
        this.preview = new Sprite(this.canvas.texture);

        this.sprite = this.addPart(new SpritePart(spr));
        this.sprite.scale = {x: this.scale,y:this.scale}


        this.lines.lineStyle(3,0x000000);
        this.lines.zIndex = 1000;
        for(let i = 0; i < this.canvas.width; i++){
            this.lines.moveTo(i * this.scale, 0);
            this.lines.lineTo(i * this.scale, this.canvas.height * this.scale);
        }
        
        for(let j = 0; j < this.canvas.height; j++){
            this.lines.moveTo(0,j * this.scale);
            this.lines.lineTo(this.canvas.width * this.scale, j  * this.scale);
        }


        this.startNewFrame();

        
        this.gui = new GUI();
        this.gui.add(this,"currentWorkingFrame");
        this.gui.add(this, "editHead")
        this.gui.add(this, "editBody")
        this.gui.add(this, "editLeftHand")
        this.gui.add(this, "editRightHand")
        this.gui.add(this, "editLeftFoot")
        this.gui.add(this, "editRightFoot")

        this.gui.add(this, "startNewFrame")
        this.gui.add(this, "save");
        this.gui.add(this, "startEditingFromFilePrompt");
    }

    private startEditingFromFilePrompt(){
        const data = prompt("Info");
        this.startEditingSavedData(data);
    }

     // Assume you call this first thing, 
    private startEditingSavedData(dataAsString: string){
        this.animationData.frameData = [];
        
        const animation = JSON.parse(dataAsString);
    
        const frameData = animation.frameData;
    
        for(const frame of frameData){

            this.animationData.frameData.push({
                frame: frame.frame,
                body: {
                    canvas: PixelArtCanvas.fromSave(frame.body.canvas),
                    relativeX: frame.body.relativeX,
                    relativeY: frame.body.relativeY,
                },
                head: {
                    canvas: PixelArtCanvas.fromSave(frame.head.canvas),
                    relativeX: frame.head.relativeX,
                    relativeY: frame.head.relativeY,
                },
                leftFoot: {
                    canvas: PixelArtCanvas.fromSave(frame.leftFoot.canvas),
                    relativeX: frame.leftFoot.relativeX,
                    relativeY: frame.leftFoot.relativeY,
                },
                leftHand: {
                    canvas: PixelArtCanvas.fromSave(frame.leftHand.canvas),
                    relativeX: frame.leftHand.relativeX,
                    relativeY: frame.leftHand.relativeY,
                },
                rightFoot: {
                    canvas: PixelArtCanvas.fromSave(frame.rightFoot.canvas),
                    relativeX: frame.rightFoot.relativeX,
                    relativeY: frame.rightFoot.relativeY,
                },  
                rightHand: {
                    canvas: PixelArtCanvas.fromSave(frame.rightHand.canvas),
                    relativeX: frame.rightHand.relativeX,
                    relativeY: frame.rightHand.relativeY,
                },
            })
        }

        this.redraw();
    }

    // Called to select a part
    private editPart(part: "head" | "body" | "leftHand" | "rightHand" | "leftFoot" | "rightFoot" ){
        const frame = this.animationData.frameData[this.currentWorkingFrame];
        if(frame[part] === null){
            const answer = prompt("Size");
            if(answer === undefined || answer === null) return alert("Undefined");

            const size = answer.split(" ");
            const width = Number(size[0]);
            const height = Number(size[1]);

            if(width === undefined || height === undefined) return alert("Undefined")

            if(width > this.canvas.width) return alert("Too wide")
            if(height > this.canvas.height) return alert("Too tall")

            const sub = new PixelArtCanvas(width,height);
            frame[part] = {
                canvas : sub,
                relativeX : 0,
                relativeY : 0,
            }
        } else if (this.selectedBodyPart === part){
            // If already editing this, offer to resize

            const answer = prompt("Resize, must be larger");
            if(answer === undefined || answer === null) return alert("Undefined");

            if(answer === "delete") {
                frame[part] = null;
                this.selectedBodyPart = undefined;
                this.redraw();
                return;
            }

            const size = answer.split(" ");
            const width = Number(size[0]);
            const height = Number(size[1]);

            if(width === undefined || height === undefined) return alert("Undefined")

            if(width < frame[part].canvas.width) return alert("Must be wider")
            if(height < frame[part].canvas.height) return alert("Must be wider")

            if(width > this.canvas.width) return alert("Too wide");
            if(height > this.canvas.height) return alert("Too tall");

            const sub = new PixelArtCanvas(width,height);
            sub.setSubCanvas(frame[part].canvas, 0, 0);
            frame[part] = {
                canvas : sub,
                relativeX : frame[part].relativeX,
                relativeY : frame[part].relativeY,
            }
        }
        this.selectedBodyPart = part;
        this.redraw();
    }

    private editHead(){
        this.editPart("head");
    }

    private editBody(){
        this.editPart("body");
    }

    private editLeftHand(){
        this.editPart("leftHand");
    }

    private editRightHand(){
        this.editPart("rightHand");
    }

    private editLeftFoot(){
        this.editPart("leftFoot");
    }

    private editRightFoot(){
        this.editPart("rightFoot")          
    }

    override onAdd(){
        this.engine.renderer.addSprite(this.lines);

        this.preview.y = -this.canvas.height;

        const g = new Graphics();
        g.lineStyle(1, 0xFFFFFF)
        g.drawRect(0, 0, this.canvas.width, this.canvas.height)
        this.preview.addChild(g)

        this.engine.renderer.addSprite(this.preview);

        this.workingFrameGraphics.x = -200;
        this.engine.renderer.addSprite(this.workingFrameGraphics);
        this.bodyPartGraphics.x = this.canvas.width * this.scale
        this.engine.renderer.addSprite(this.bodyPartGraphics);
        this.engine.renderer.addSprite(this.highlightSelectedPart);
    }
    override onDestroy(){
        this.engine.renderer.removeSprite(this.lines);
        this.engine.renderer.removeSprite(this.preview);
        this.engine.renderer.removeSprite(this.workingFrameGraphics);
        this.engine.renderer.removeSprite(this.bodyPartGraphics);
        this.engine.renderer.removeSprite(this.highlightSelectedPart);
    }

    private switchToFrame(frame: number){
        this.currentWorkingFrame = frame;
        this.selectedBodyPart = undefined;
        this.redraw();
    }

    private startNewFrame(){
        // Copies everything from the frame before it;

        this.currentWorkingFrame = this.animationData.frameData.length;

        let data: PlayerAnimationFrame;
        if(this.currentWorkingFrame === 0){
            data = {
                frame: this.currentWorkingFrame,
                body: null,
                head: null,
                leftFoot: null,
                leftHand: null,
                rightFoot: null,
                rightHand: null,
            }
        } else {

            if(!this.validateFrame(this.currentWorkingFrame - 1)) { 
                this.currentWorkingFrame = this.animationData.frameData.length - 1;
                return alert("Last frame not complete");
            }

            const lastFrame = this.animationData.frameData[this.currentWorkingFrame - 1];
            data = {
                frame: this.currentWorkingFrame,
                body: {
                    canvas:lastFrame.body.canvas.clone(),
                    relativeX:lastFrame.body.relativeX,
                    relativeY:lastFrame.body.relativeY,
                },
                head: {
                    canvas:lastFrame.head.canvas.clone(),
                    relativeX:lastFrame.head.relativeX,
                    relativeY:lastFrame.head.relativeY,
                },
                leftFoot: {
                    canvas:lastFrame.leftFoot.canvas.clone(),
                    relativeX:lastFrame.leftFoot.relativeX,
                    relativeY:lastFrame.leftFoot.relativeY,
                },
                leftHand:{
                    canvas:lastFrame.leftHand.canvas.clone(),
                    relativeX:lastFrame.leftHand.relativeX,
                    relativeY:lastFrame.leftHand.relativeY,
                },
                rightFoot: {
                    canvas:lastFrame.rightFoot.canvas.clone(),
                    relativeX:lastFrame.rightFoot.relativeX,
                    relativeY:lastFrame.rightFoot.relativeY,
                },
                rightHand: {
                    canvas:lastFrame.rightHand.canvas.clone(),
                    relativeX:lastFrame.rightHand.relativeX,
                    relativeY:lastFrame.rightHand.relativeY,
                },
            }
        }
        this.selectedBodyPart = undefined;
        this.animationData.frameData.push(data);
        this.redraw();
    }

    private validateFrame(frameNumber: number): boolean {
        const frame = this.animationData.frameData[frameNumber];
        if(frame.head === null ||
            frame.body === null ||
            frame.leftHand === null ||
            frame.rightHand === null ||
            frame.leftFoot === null ||
            frame.rightFoot === null){
                return false;
        }
        
        return true;
    }

    /** Returns JSON Stringified version of the data, so can be stored */
    save(): string {
        // Validation, fail if any null data
        for(let i = 0; i < this.animationData.frameData.length; i++){
            if(!this.validateFrame(i)) {
                alert("Null body data on frame " + i);
                return null;
            }
        }

        const frameData = this.animationData.frameData.map((value) => {
            return {
                frame: value.frame,
                // Pretty huge export size even for simple data
                body: {
                    canvas: value.body.canvas.saveableVersion(),
                    relativeX: value.body.relativeX,
                    relativeY: value.body.relativeY
                },
                head: {
                    canvas: value.head.canvas.saveableVersion(),
                    relativeX: value.head.relativeX,
                    relativeY: value.head.relativeY
                },
                leftFoot: {
                    canvas: value.leftFoot.canvas.saveableVersion(),
                    relativeX: value.leftFoot.relativeX,
                    relativeY: value.leftFoot.relativeY
                },
                leftHand: {
                    canvas: value.leftHand.canvas.saveableVersion(),
                    relativeX: value.leftHand.relativeX,
                    relativeY: value.leftHand.relativeY
                },
                rightFoot: {
                    canvas: value.rightFoot.canvas.saveableVersion(),
                    relativeX: value.rightFoot.relativeX,
                    relativeY: value.rightFoot.relativeY
                },
                rightHand: {
                    canvas: value.rightHand.canvas.saveableVersion(),
                    relativeX: value.rightHand.relativeX,
                    relativeY: value.rightHand.relativeY
                }

            }
        })
        

        const saved = {
            originX:0,
            originY:0,
            frameData: frameData
        };

        const str = JSON.stringify(saved)
        console.log(str)

        return str;
    }

   

    update(dt: number): void {
        this.redrawUI();

        const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
        // console.log(currentFrame)
        if(this.selectedBodyPart !== undefined){
            const selectedCanvas = currentFrame[this.selectedBodyPart];

            const left = selectedCanvas.relativeX * this.scale;
            const top = selectedCanvas.relativeY * this.scale;

            const rect = new Rect(left, top, selectedCanvas.canvas.width * this.scale, selectedCanvas.canvas.height * this.scale); 

            // Draw to THAT canvas
            if(rect.contains(this.mouse.position)){
                if(this.mouse.isDown("left")){
                    const mouse = this.mouse.position;

                    const R = 0;
                    const G = 0;
                    const B = 0;
                    const A = 255;

                    selectedCanvas.canvas.setPixel(floor((mouse.x - left) / this.scale), floor((mouse.y - top) / this.scale), R, G, B, A);
                    this.redraw();
                } else if(this.mouse.isDown("right")){
                    const mouse = this.mouse.position.clone().floor();
                    selectedCanvas.canvas.setPixel(floor((mouse.x - left) / this.scale), floor((mouse.y - top) / this.scale), 0, 0, 0, 0);
                    this.redraw();
                }
            }

            const keyboard = this.keyboard.isDown("ShiftLeft") ? this.simpleKeyboardPressedCheck() : this.simpleKeyboardCheck()
            selectedCanvas.relativeX += keyboard.x;
            selectedCanvas.relativeY += keyboard.y;

            if(keyboard.x !== 0 || keyboard.y !== 0) this.redraw();
        }

        if(this.mouse.wasReleased("left")){
            for(let i = 0; i < this.animationData.frameData.length; i++){
                if(this.mouse.x > -200 && this.mouse.x < 0 && this.mouse.y > i * 100 && this.mouse.y < i * 100 + 99) {
                    this.switchToFrame(i);
                }                    
            }
        }
    }

    private redrawUI(){
        this.workingFrameGraphics.clear();

        for(let i = 0; i < this.animationData.frameData.length; i++){
            if(i === this.currentWorkingFrame) this.workingFrameGraphics.beginFill(0xFFFFF0)
            else this.workingFrameGraphics.lineStyle(3, 0xFFFFFF)

            if(this.mouse.x > -200 && this.mouse.x < 0 && this.mouse.y > i * 100 && this.mouse.y < i * 100 + 99) this.workingFrameGraphics.beginFill(0x00FFF0)
            this.workingFrameGraphics.drawRect(0, i * 100, 200, 100);
            this.workingFrameGraphics.endFill()
        }

        

        this.bodyPartGraphics.clear();

        const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
        
        //#region 
        let i = 0;
        if(currentFrame.head !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        i++

        if(currentFrame.body !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        i++
       

        if(currentFrame.leftHand !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        i++

        if(currentFrame.rightHand !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        i++

        if(currentFrame.leftFoot !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        i++

        if(currentFrame.rightFoot !== null){
            this.bodyPartGraphics.beginFill(0x00FF00);
            this.bodyPartGraphics.drawRect(0,i * 200,200,200);
            this.bodyPartGraphics.endFill();
        }
        //#endregion

        this.highlightSelectedPart.clear();
        if(this.selectedBodyPart !== undefined){
            this.highlightSelectedPart.beginFill(0x00FF00, .2)

            const selectedCanvas = currentFrame[this.selectedBodyPart];

            this.highlightSelectedPart.drawRect(selectedCanvas.relativeX * this.scale, selectedCanvas.relativeY * this.scale, selectedCanvas.canvas.width * this.scale, selectedCanvas.canvas.height * this.scale)
        }
    }

    private redraw(){
        const currentFrame = this.animationData.frameData[this.currentWorkingFrame];
        this.canvas.clear();

        if(currentFrame.head !== null){
            this.canvas.setSubCanvas(currentFrame.head.canvas, currentFrame.head.relativeX, currentFrame.head.relativeY)
        }

        if(currentFrame.body !== null){
            this.canvas.setSubCanvas(currentFrame.body.canvas, currentFrame.body.relativeX, currentFrame.body.relativeY)
        }
        
        if(currentFrame.leftHand !== null){
            this.canvas.setSubCanvas(currentFrame.leftHand.canvas, currentFrame.leftHand.relativeX, currentFrame.leftHand.relativeY)
        }

        if(currentFrame.rightHand !== null){
            this.canvas.setSubCanvas(currentFrame.rightHand.canvas, currentFrame.rightHand.relativeX, currentFrame.rightHand.relativeY)
        }

        if(currentFrame.leftFoot !== null){
            this.canvas.setSubCanvas(currentFrame.leftFoot.canvas, currentFrame.leftFoot.relativeX, currentFrame.leftFoot.relativeY)
        }

        if(currentFrame.rightFoot !== null){
            this.canvas.setSubCanvas(currentFrame.rightFoot.canvas, currentFrame.rightFoot.relativeX, currentFrame.rightFoot.relativeY)
        }
    }
}
//#endregion

export class FrameEditor extends BearGame<BearEngine> {
    
    renderer = this.registerSystem(new DefaultEntityRenderer(this));

    initSystems(): void {

    }
    
    update(dt: number): void {
        this.entities.update(dt);

        this.renderer.update(dt);
    }

    onStart(): void {

        this.engine.renderer.setBackgroundColor(rgb(22, 30, 80));

        this.entities.addEntity(new PlayerAnimator());
    }

    onEnd(): void {

    }
    
} 


// Represents a canvas that can be drawn to, pixel by pixel
class PixelArtCanvas {
    readonly width: number;
    readonly height: number;
    readonly colorData: Uint8Array;
    readonly texture: Texture;

    constructor(width: number, height: number){
        this.width = width;
        this.height = height;

        this.colorData = new Uint8Array(4 * width * height);
        
        //White by default
        //this.colorData.fill(255);

        this.texture = Texture.fromBuffer(this.colorData, width, height)
    }

    static fromSave(data: {color: number[], width: number, height: number}): PixelArtCanvas {
        const canvas = new PixelArtCanvas(data.width, data.height);
    
        const colorData = data.color;
        for(let i = 0; i < data.color.length; i++){
            canvas.colorData[i] = colorData[i];
        }
        
        return canvas;
    }

    saveableVersion(): {color: number[], width: number, height: number}{
        return {
            width: this.width,
            height: this.height,
            color: Array.from(this.colorData),
        }
    }

    clear(){
        this.colorData.fill(0);
        this.update();
    }

    update(){
        this.texture.update();
    }

    clone(): PixelArtCanvas {
        const canvas = new PixelArtCanvas(this.width, this.height);
        canvas.setSubCanvas(this,0,0);
        return canvas;
    }
 
    /** If point is transparent, value ignored */
    setSubCanvas(canvas: PixelArtCanvas, x: number, y: number){
        for(let i = 0; i < canvas.width; i++){
            const thisCanvasX = x + i;

            for(let j = 0; j < canvas.height; j++){
                const thisCanvasY = y + j;

                const subCanvasIndex = (i + j * canvas.width) * 4;

                const R = canvas.colorData[subCanvasIndex];
                const G = canvas.colorData[subCanvasIndex + 1];
                const B = canvas.colorData[subCanvasIndex + 2];
                const A = canvas.colorData[subCanvasIndex + 3];

                if(A === 0) continue;
                this.setPixel(thisCanvasX, thisCanvasY, R, G, B, A); 
            }
        }
    }

    createSubCanvas(x: number, y: number, width: number, height: number): PixelArtCanvas {
        const canvas = new PixelArtCanvas(width, height);

        // Transfer over data
        for(let i = 0; i < width; i++){
            const canvasX = x + i;

            for(let j = 0; j < height; j++){
                const canvasY = y + j;

                const canvasIndex = (canvasX + canvasY * this.width) * 4;

                const R = this.colorData[canvasIndex];
                const G = this.colorData[canvasIndex + 1];
                const B = this.colorData[canvasIndex + 2];
                const A = this.colorData[canvasIndex + 3];

                canvas.setPixel(i, j, R, G, B, A); 
            }
        }

        return canvas;
    }



    // rbga [0,255]
    setPixel(x: number, y: number, R: number, G: number, B: number, A: number){
        const index = x + y * this.width;
        
        const realIndex = index * 4;

        if(realIndex < this.colorData.length){
            this.colorData[realIndex] = R;
            this.colorData[realIndex + 1] = G;
            this.colorData[realIndex + 2] = B;
            this.colorData[realIndex + 3] = A;
            
            this.texture.update();
        }
    }

    
}




// attempt at circle line physics
export class CircleEntity extends DrawableEntity {
    
    radius = (25);
    speed = 40;
    velocity = new Vec2(0,30);

    constructor(point: Coordinate){
        super();
        this.position.set(point);
        this.redraw();
    }

    draw(g: Graphics): void {
        g.beginFill(0x00FF00);
        g.drawCircle(this.x, this.y, this.radius);
    }

    tick = new TickTimer(20,true)

    update(dt: number): void {
        if(!this.tick.tick()) return;
        this.redraw(true)
        // this.velocity.y += .1;


        const destination = Vec2.add(this.velocity,this.position);

        // This is gonna fail in colliding with edge of polygon
        const test = this.terrain.lineCollisionExt(this.position, destination);

        if(test !== null){
            // console.log("AHHH")
            const x1 = test.line.A.clone().sub(this.position);
            const x2 = test.line.B.clone().sub(this.position);

            const a = test.point.sub(this.position);
            const b = Line.PointClosestToLine(x1,x2,this.velocity);
            const c = Line.PointClosestToLine(Vec2.ZERO, this.velocity, x1);
            const d = Line.PointClosestToLine(Vec2.ZERO, this.velocity, x2);

            const p1 = Line.PointClosestToLine(x1, x2,Vec2.ZERO);

            // Final position
            const p2 = Vec2.subtract(a, this.velocity.clone().normalize().scale(this.radius * a.length()/p1.length()));


            const pointC = Line.PointClosestToLine(x1, x2, p2);


            const p3 = Vec2.add(p2, Vec2.subtract(p1, pointC));

            const r = Vec2.add(Vec2.subtract(p3, p2).scale(2),p2).normalize().negate();

            
    
            //this.position.set(p2.add(this.position));

            const temp = r.scale(this.velocity.length())

            this.velocity.set(temp);
            this.position.add(this.velocity);

            drawVecAsArrow(this.canvas.graphics,temp,this.x, this.y,1);

            this.canvas.graphics.drawCircle(a.x + this.x, a.y + this.y, 3)
            this.canvas.graphics.drawCircle(b.x + this.x, b.y + this.y, 3)
            this.canvas.graphics.drawCircle(c.x + this.x, c.y + this.y, 3)
            this.canvas.graphics.drawCircle(d.x + this.x, d.y + this.y, 3)
            
            this.canvas.graphics.beginFill(0x0000FF)
            this.canvas.graphics.drawCircle(pointC.x + this.x, pointC.y + this.y, 3)

            this.canvas.graphics.beginFill(0xFF0000)
            this.canvas.graphics.drawCircle(p2.x + this.x, p2.y + this.y, 25)
        } else {
            this.position.add(this.velocity);
        }

        
        
    }


}


export function loadTestLevel(engine: BearEngine): void {
    //const scene = engine.entityManager;

    const scene = null

    // class Test123 extends Entity {

    //     update(dt: number): void {
    //         if(this.mouse.wasPressed("left")){
    //             this.scene.addEntity(new CircleEntity(this.mouse.position));
    //         }
    //     }

    // }

    // scene.addEntity(new Test123()); 
    

    class TerrainPolygonCarveTest extends DrawableEntity {
        
        private point: Vec2;
        
        private polygon = Polygon.random(5, 170);

        constructor(){
            super();
        }

        update(dt: number): void {
            this.point = this.mouse.position.clone()// this.poly.polygon.closestPoint(this.Mouse.position);
            //console.log(this.point)
            if(this.mouse.wasPressed("left")) { 
                this.terrain.carvePolygon(this.polygon, this.point);
            }

            if(this.keyboard.wasReleased("KeyY")) this.polygon = Polygon.random(5,180)
            
            this.redraw(true);
        }

        draw(g: Graphics): void {
            // @ts-expect-error
            g.position = this.point// (this.point.x, this.point.y);
            this.polygon.draw(g, 0x0000FF);

            drawPoint(g,this.point,0xFF0000);   
        }
    }
    
    // scene.addEntity(new TerrainPolygonCarveTest());

    class TerrainCarveTest extends DrawableEntity {
        
        private point: Vec2;
        private radius = 50;

        constructor(){
            super();
        }

        update(dt: number): void {
            this.point = this.mouse.position.clone()// this.poly.polygon.closestPoint(this.Mouse.position);
           //console.log(this.point)
            if(this.mouse.wasPressed("left")) { 
                this.terrain.carveCircle(this.point.x, this.point.y, this.radius);
            }
            
            this.redraw(true);
        }

        draw(g: Graphics): void {
            const factor = 3;
            if(this.keyboard.isDown("ArrowUp")) this.radius += 1 * factor
            if(this.keyboard.isDown("ArrowDown")) this.radius -= 1 * factor
        
            drawCircle(g,this.point, this.radius, undefined, .3)

            drawPoint(g,this.point,0xFF0000);   
        }
    }
    
    // scene.addEntity(new TerrainCarveTest());


    class EntityLoadTest extends Entity {
        
        private tick = new TickTimer(30, true);


        private entities: EntityID[] = []

        private AMOUNT = 100000;

        ticking = false;

        update(dt: number): void {
            if(this.mouse.wasReleased("left")){
                

                // This avoids performance including time for JS engine to allocate memory for the objects
                const tempEntities: EmptyEntity[] = []
                for(let i = 0; i < this.AMOUNT; i++){
                    tempEntities.push(new EmptyEntity());
                }


                const start = performance.now();

                for(let i = 0; i < this.AMOUNT; i++){
                    this.entities.push(this.scene.addEntity(tempEntities[i]).entityID);
                }

                console.log("Time to create:",performance.now() - start)
                this.ticking = true;
            }

            if(this.ticking){
                if(this.tick.tick()){
                    const start = performance.now();

                    for(let i = 0; i < this.AMOUNT; i++){
                        this.scene.destroyEntityID(this.entities[i]);
                    }

                    this.entities = [];

                    this.ticking = false;
                    this.tick.counter = 0;

                    console.log("Time to destroy:",performance.now() - start)
                }
            }
        }

    }

    // this.addEntity(new EntityLoadTest());


    class TestEntityForVideo extends Entity {
        
        private sprite = this.addPart(new SpritePart("tree.gif"));
        private collider = this.addPart(new ColliderPart(dimensions(200,200), Vec2.ZERO));

        update(dt: number): void {
            
        }

        // @bearevent("mousehover", {})
        daisvfdakusvdjasd(point: Vec2){
            console.log("Hello, i was hovered", point.toString());
        }

        //@bearevent("tap", {})
        ontapcallback(num: Vec2){
            console.log("I was clicked")
        }

        @bearevent("mousedown", { button: "left"})
        asdasdasdasd(point: Vec2){
            console.log("HEOLLO")
        }

        @bearevent("scroll", {})
        asdasd(scroll: number, point: Vec2){
            console.log(scroll)
        }

    }
    // scene.addEntity(new TestEntityForVideo());
    
    // Drawing the collision grid
    class Debug extends DrawableEntity {
        update(dt: number): void {
            this.redraw();
        }
        draw(g: Graphics): void {
            g.clear();
            this.game.collisionManager.draw(g);
        }
    }
    // this.addEntity(new Debug())



    class ConvexHullTest extends DrawableEntity {
 
        original: Polygon;
        convex: Polygon;

        constructor(){
            super();

            this.original = Polygon.random(20);

            this.convex = this.original.convexhull();
            this.redraw();
        }
            
        update(dt: number): void {
        }
        
        
        draw(g: Graphics): void {
            this.original.draw(g,0xFF0000)
            this.convex.draw(g,0x00FF00);
        }

    }

    //this.addEntity(new ConvexHullTest());

    class CircleLineIntersectionTest extends DrawableEntity {
        
        private circle = new Vec2(0,0);
        
        private point = new Vec2(0,0);

        draw(g: Graphics): void {
            drawCircle(g, this.circle, 50)

            if(this.mouse.wasPressed("left")) this.point = this.mouse.position.clone();

            const otherPoint = this.mouse.position.clone();

            drawLineBetweenPoints(g,this.point,otherPoint);

            const points = Line.CircleLineIntersection(this.point, otherPoint, this.circle.x, this.circle.y, 50);
            
            for(const point of points.points){
                drawPoint(g,point);
            }
        }
        update(dt: number): void {
            this.redraw()
        }

    }

    //this.addEntity(new CircleLineIntersectionTest);


    class MouseRectCollider extends DrawableEntity {
        private r: ColliderPart;

        constructor(){
            super();
            this.addPart(this.r = new ColliderPart(dimensions(50,50), new Vec2(20,20)))
        }

        update(dt: number): void {
            this.position.set(this.mouse.position);

            if(this.keyboard.isDown("KeyK")) this.scene.destroyEntity(this)

            this.redraw();
        }
        
        draw(g: Graphics): void {
            g.clear();
            this.r.rect.draw(g,0xFF0000);
        }
    }

    // this.addEntity(new MouseRectCollider());

    class TestCollision extends DrawableEntity {
        private line: Line;
        private r: Rect;
        constructor(){
            super();
            this.addPart(new ColliderPart(dimensions(50,50), new Vec2(20,20)))
            this.r = new Rect(100,150,50,50);
            this.line = new Line(new Vec2(0,0), new Vec2(0,0));
        }

        update(dt: number): void {
            this.line.B.set(this.mouse.position);
            if(this.mouse.wasPressed("left")){
                this.line.A.set(this.mouse.position);
            }

            this.redraw();
        }
        
        draw(g: Graphics): void {
            g.clear();
            //this.r.draw(g)
            //this.line.draw(g,Rect.CollidesWithLine(this.r, this.line.A.x, this.line.A.y, this.line.B.x, this.line.B.y) ? "#FF0000":"#0000FF" );
        }
    }
    //this.addEntity(new TestCollision())

   

    // Rectangle overlap test
    class Test extends DrawableEntity {
        
        private rec1 = new Rect(400,400,100,100);
        private anchorPoint = new Vec2(0,0);

        update(dt: number): void {
            if(this.mouse.wasPressed("left")){
                this.anchorPoint.set(this.mouse.position);
            }
            this.redraw()
        }

        draw(g: Graphics): void {
            g.clear();
            g.lineStyle(3, rgb(255,0,0).hex());
            this.rec1.draw(g, 0xFF0000);
    
            const rec2 = Rect.fromPoints(this.anchorPoint, this.mouse.position);
            rec2.draw(g, 0x00FF00)

            const overlap =  this.rec1.intersection(rec2);
            if(overlap) overlap.draw(g,0x0000FF);

        }
    }
    //this.addEntity(new Test())

    // Color blend of hermite curve
    class Test2 extends DrawableEntity {
        private bez = new HermiteCurve([
            new Vec2(0,0), 
            new Vec2(500,0), 
            new Vec2(100,100), 
            new Vec2(200,100), 
            new Vec2(0,300),
            new Vec2(-100,300),
            new Vec2(-300,0),
            new Vec2(-100,200),
        ])

        private percent: number = 0;
        private points = this.bez.bakePoints();

        private color: Color;

        constructor(){
            super();
            this.color = rgb(255,255,255);

            this.scene.addEntity(
                new ColorTween(this, "color", 5).from(this.color.clone()).to(rgb(255,5,5)).go()
            ).chain(new ColorTween(this, "color", 2).from((rgb(255,5,5))).to(rgb(1,0,255)))
        }

        update(dt: number): void {
            this.percent += +this.mouse.isDown("left") * .01;
            this.percent %= 1;
            this.redraw()
        }

        draw(g: Graphics): void {
            g.clear();
            this.points.draw(g, this.color.hex());
        }
    }
    //this.addEntity(new Test2())

    // GRID QUADTREE
    class Quadquadtest extends DrawableEntity {
        
        private q = new LiveGridQuadTree(128);
        private scale = 16;

        constructor(){
            super();
            this.q.calculateEdges();
            this.redraw();
            this.canvas.graphics.addChild(this.hoverGraphic)
        }

        private hoverGraphic = new Graphics();

        private start = new Vec2(0,0);
        private target = new Vec2(0,0);

        private flip = false;


        update(dt: number): void {
            if(this.mouse.isDown("left")){

                const x = floor(this.mouse.position.x / this.scale);
                const y = floor(this.mouse.position.y / this.scale)

                this.q.insert(x,y);
                

                this.q.insert(x+1,y);
                this.q.insert(x-1,y);
                this.q.insert(x,y+1);
                this.q.insert(x,y-1);

                this.q.insert(x+1,y+1);
                this.q.insert(x+1,y-1);
                this.q.insert(x-1,y+1);
                this.q.insert(x-1,y-1);

                this.q.calculateEdges();

                this.q.startPath(this.start.x, this.start.y, this.target.x, this.target.y);

                this.redraw();
            } else if(this.keyboard.wasPressed("KeyE")){
                const x = floor(this.mouse.position.x / this.scale);
                const y = floor(this.mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.q.startPath(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
            } else if(this.mouse.isDown("right")){
                 

                this.q.stepPath();
            
                this.redraw();
            }

            this.hoverGraphic.clear();

            const x = floor(this.mouse.position.x / this.scale);
            const y = floor(this.mouse.position.y / this.scale);

            const node = this.q.getNode(x,y)
            if(node !== null) node.draw(this.hoverGraphic,this.scale, 9, 0x0000FF);
        }

        draw(g: Graphics): void {
            g.clear();

            this.q.draw(g,this.scale);
        }

    }

    //this.addEntity(new Quadquadtest())

    // ASTAR GRID
    class Test3 extends DrawableEntity {

        private grid = new LiveGridGraph(128,128);

        private scale = 16;

        constructor() {
            super();
            this.grid.start_astar(0,0,24,12);
            this.grid.step_astar();

            this.redraw();
        }

        private start = new Vec2(0,0);
        private target = new Vec2(0,0);

        private flip = false;

        update(dt: number): void {
            if(this.mouse.isDown("left")){
                const x = floor(this.mouse.position.x / this.scale);
                const y = floor(this.mouse.position.y / this.scale);
                
                this.grid.blockcell(x,y);

                this.grid.blockcell(x+1,y);
                this.grid.blockcell(x-1,y);
                this.grid.blockcell(x,y+1);
                this.grid.blockcell(x,y-1);

                this.grid.blockcell(x+1,y+1);
                this.grid.blockcell(x+1,y-1);
                this.grid.blockcell(x-1,y+1);
                this.grid.blockcell(x-1,y-1);

                this.grid.start_astar(this.start.x, this.start.y, this.target.x, this.target.y);
                
                this.redraw();
            } else if(this.keyboard.wasPressed("KeyE")){
                const x = floor(this.mouse.position.x / this.scale);
                const y = floor(this.mouse.position.y / this.scale);

                if(!this.flip)
                    this.start.set({x: x, y: y});
                else
                    this.target.set({x: x, y: y});

                
                this.flip = !this.flip;
                this.grid.start_astar(this.start.x, this.start.y, this.target.x, this.target.y)
                this.redraw();
                
            } else if(this.mouse.isDown("right")){
                this.grid.step_astar();
                this.redraw();
            }
        }

        draw(g: Graphics): void {
            g.clear();
            g.x = this.scale * 128;   
            this.grid.draw(g,this.scale);
        }
    }
    //this.addEntity(new Test3());

    class FirstSprite extends GMEntity {
        constructor(spot: Coordinate){
            super(spot,"tree.gif", dimensions(50,50));
            this.image.originPercent = ({x:.5, y:.5})
        }

        update(dt: number): void {
            // SimpleMovement(this,250 * dt);
            this.moveTowards(this.mouse.position,21);
            this.image.angleTowardsPoint(this.mouse.position, PI / 30);
        }

        draw(g: Graphics): void {
            
        }
    }
    //this.addEntity(new FirstSprite({x:50,y:170}));


    // Quadtree drawing test
    class Q extends DrawableEntity {
        private tree = new QuadTree<Vec2>(2000,2000, a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(this.keyboard.wasPressed("KeyF")){
                this.tree.insert(this.mouse.position.clone());
                this.redraw();
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.tree.draw(g);
        }
    }
    //this.addEntity(new Q())

    // Clockwise test
    class PolygonTest extends DrawableEntity {

        public p = Polygon.from([new Vec2(0,170),  new Vec2(150,0), new Vec2(0,0)]);

        constructor(){super(); this.redraw();}

        update(dt: number): void {}

        draw(g: Graphics): void {
            this.p.draw(g);
        }
    }
    
    // this.addEntity(new PolygonTest());

    // TileMap collision
    class Tilemaptest extends DrawableEntity {

        private map = new Tilemap(30,30,80,80);
        private testobject: SpriteEntity;

        constructor(){
            super();
            
            class test3 extends SpriteEntity {
                update(dt: number): void {}
                draw(g: Graphics): void {}
            }

            this.testobject =  new test3(Vec2.ZERO, "flower.png");
            this.scene.addEntity(this.testobject);

            for(let i = 1; i < 30; i++){
                for(const index of randomRangeSet(0,30,30)){
                    this.map.setCell(index,i);
                }
            }

            this.canvas.graphics.zIndex = -10000;
        }

        update(dt: number): void {
            this.redraw();
            const testMove = this.simpleKeyboardCheck(6);
            this.testobject.position.add(this.map.potentialMove(this.testobject.collider.rect, testMove));
        }

        draw(g: Graphics): void {
            g.clear();
           
            this.map.draw(g);
            this.testobject.collider.rect.draw(g);
            

            drawPoint(g,this.mouse.position, this.map.isSolid(this.mouse.position.x, this.mouse.position.y) ? 0xFF0000:0x0000FF);
        }


    }

    //this.addEntity(new Tilemaptest());


    class conwaytest extends DrawableEntity {

        private conway = new ConwaysLife(60,60);
        private accumulation = -.5;

        constructor(){
            super();
            for(let i = 0; i < 60; i++){
                for(const index of randomRangeSet(0,60,20)){
                    this.conway.makeCellAlive(i,index);
                }
            }
            this.redraw()

        }

        update(dt: number): void {
            this.accumulation += dt;
            if(this.accumulation > .1){
                this.conway.updategrid();
                this.redraw();
                this.accumulation = 0;
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.conway.draw(g);
        }

    }
    //this.addEntity(new conwaytest())

    class LightningTest extends DrawableEntity {

        private startPoint = Vec2.ZERO;

        private lines: Line[] = [];

        private ticker = new TickTimer(6);

        update(dt: number): void {
            if(!this.ticker.tick()) return;
            this.lines = [];
            if(this.mouse.wasPressed("left")){
                this.startPoint = this.mouse.position.clone();
            }
            const mousePoint = this.mouse.position.clone();

            this.lines.push(new Line(this.startPoint, mousePoint));
            
            // the longer the distance, the bigger this needs to be
            // so the lightning looks natural
            let offset =150;

           
            // how many times do we cut the segment in half?
            for (let i = 0; i < 5; i++) {

                const newLines: Line[] = [];

                for(const line of this.lines){
                    const midPoint = mix(line.A, line.B, .5);
                    
                    midPoint.add(Line.normal(line.A, line.B).extend(random_range(-offset,offset)));

                    newLines.push(new Line(line.A, midPoint))
                    newLines.push(new Line(midPoint, line.B));

                    /// sometimes, split!
                    if(chance(18)){
                        const dir = Vec2.subtract(midPoint, line.A);
                        dir.drotate(random_range(-30,30)).scale(.7).add(midPoint);
                        newLines.push(new Line(midPoint, dir));
                    }
                }

                this.lines = newLines;
                offset /= 2;
            }

            

            this.redraw();
        }


        draw(g: Graphics): void {
            g.clear();
            for(const line of this.lines){
                line.draw(g,0xFFFFFF);
            }
        }

    }
    //this.addEntity(new LightningTest());
    
    // Quadtree drawing test
    class SpatialTest extends DrawableEntity {
        private sparse = new SparseGrid<Vec2>(1000,1000,10,10,a => new Rect(a.x, a.y,4,4));
        private nope = this.redraw();
    
        update(dt: number): void {
            if(this.keyboard.wasPressed("KeyF")){
                this.sparse.insert(this.mouse.position.clone());
                this.redraw();
                console.log(this.sparse["hashmap"]["arr"])
            }
        }
        draw(g: Graphics): void {
            g.clear();
            this.sparse.draw(g);
        }
    }
    // this.addEntity(new SpatialTest())


    class LineCloseTest extends DrawableEntity {

        private line = new Line(new Vec2(100,60), new Vec2(10,200));
        private p = this.redraw()

        update(dt: number): void {
            this.redraw();
        }
        draw(g: Graphics): void {
            g.clear();
            this.line.draw(g);
            drawPoint(g,this.line.pointClosestTo(this.mouse.position));
        }

    }
    //this.addEntity(new LineCloseTest());


    class DynAABBTest extends DrawableEntity {
        
        private tree = new DynamicAABBTree();

        update(dt: number): void {
            if(this.mouse.wasPressed("left")){
                this.tree.insert(new Ellipse(this.mouse.position.clone(),40,40))
                console.log(this.tree["root"])
                this.redraw();
            }

            this.tree.pointQueryTestNodes(this.mouse.position).forEach(e => e.aabb.draw(this.canvas.graphics,0x00F0FF));
        }
        draw(g: Graphics): void {
            g.clear();
            this.tree.draw(g);
        }

    }
    //this.addEntity(new DynAABBTest());


    class IK extends DrawableEntity {
        
        // Min 2 points, this list creates the IK 'arm'
        private points: Vec2[] = []

        constructor(){
            super();

            
            const points = 25;
            const lengthPerSegment = 10;

            for(let i = 0; i < points; i++){
                this.points.push(new Vec2(i * lengthPerSegment, 0))
            }
        }

        update(dt: number): void {

            if(this.mouse.wasReleased("left")) this.points[this.points.length - 1] = this.mouse.position.clone()

            let target = this.mouse.position.clone() as Coordinate;
            
            // Last point in list is the anchor 
            const base = this.points[this.points.length - 1].clone();
            //console.log(base)


            for (let i = 0; i < this.points.length - 1; i++) {
                const newTail = this.moveSegment(this.points[i], this.points[i + 1], target);
                // This modifies the vectors. They are now in the correct positions
                target = newTail;
            }       
            this.points[this.points.length - 1].set(target);

            target = base;
            for (let i = this.points.length - 1; i > 0; i--){
                const newTail = this.moveSegment(this.points[i], this.points[i - 1], target);
                target = newTail
            }
            this.points[0].set(target);

            this.redraw()
        }

        // Sets head to target, moves tail so it follows it 
        moveSegment(head: Vec2, tail: Vec2, target: Coordinate){
            const length = Vec2.distance(head, tail);
            
            const tempLength = Vec2.distance(tail, target);

            const scale = length / tempLength;

            head.set(target);
            // returns the new tail:
            return {
                x: target.x + ((tail.x - target.x) * scale),
                y: target.y + ((tail.y - target.y) * scale)
            }
        }


        draw(g: Graphics): void {
            drawPoint(g, this.points[0])
            drawLineArray(g, this.points, 0xFF0000, false)
        }

    }
    // this.addEntity(new IK())


    
}



class ConwaysLife {

    //true = alive
    private grid: boolean[][];

    private width:number;
    private height:number;

    constructor(w: number, h: number){
        this.width = w;
        this.height = h;

        this.grid = [];

        for(let i = 0; i < w; i++){
            this.grid[i] = [];
            this.grid[i].length = h;
            this.grid[i].fill(false);
        }
    }

    numberOfNeighbours(g: boolean[][], x: number, y:number): number {
        // UNCOMMENT THIS LINE FOR COOL ART
        //g = this.grid;
        let total = 0;
        
        //left
        if(x - 1 >= 0){
            total += +g[x-1][y]

            //left top
            if(y - 1 >= 0){
                total += +g[x - 1][y-1]
            }
    
            //left bot
            if(y + 1 < this.height){
                total += +g[x - 1][y + 1]
            }
        }

        if(x + 1 < this.width){
            total += +g[x+1][y]
            //left top
            if(y - 1 >= 0){
                total += +g[x + 1][y-1]
            }
    
            //left bot
            if(y + 1 < this.height){
                total += +g[x + 1][y + 1]
            }
        }

        if(y - 1 >= 0){
            total += +g[x][y-1]
        }

        if(y + 1 < this.height){
            total += +g[x][y + 1]
        }


        return total;
    }

    makeCellAlive(x: number,y: number){
        this.grid[x][y] = true;
    }

    updategrid(){
        const gridcopy: boolean[][] = [];
        for(let i = 0; i < this.width; i++){
            gridcopy[i] = [];
            for(let j = 0; j < this.height; j++){
                gridcopy[i][j] = this.grid[i][j];
            }
        }
       
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){
                const n = this.numberOfNeighbours(gridcopy,i,j);
            
                // if its alive right now
                if(gridcopy[i][j]){
                    if(n < 2){
                        this.grid[i][j] = false;
                    } else if (n === 2 || n === 3){
                        this.grid[i][j] = true;
                    // IF THIS IS CHANGE TO n > 3, in addition to other other change in neighbour getting, you can make some cool art
                    } else if (n >= 3){
                        this.grid[i][j] = false;
                    } 
                } else {
                    if(n === 3){
                        this.grid[i][j] = true;
                    }
                }
            }
        }
    }


    draw(g: Graphics, scale = 10){
        // black = alive
        for(let i = 0; i < this.width; i++){
            for(let j = 0; j < this.height; j++){

                // White if alive
                if(!this.grid[i][j]){
                    g.beginFill(0x000000);
                } else {
                    g.beginFill(0xFFFFFF)
                }

                g.drawRect(i * scale, j * scale,scale,scale);
            }
        }
    }

}

