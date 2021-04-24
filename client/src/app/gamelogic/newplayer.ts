import { AnimatedSprite, Texture } from "pixi.js";
import { TickTimer } from "shared/ticktimer";
import { Entity } from "../core-engine/entity";
import { PlayerAnimation, SavePlayerAnimation } from "./testlevelentities";


interface PartData {
    textures: Texture;
    x: number,
    y: number
}

export class NewPlayer extends Entity {
    
    headSprite: AnimatedSprite;
    bodySprite: AnimatedSprite;
    leftHandSprite: AnimatedSprite;
    rightHandSprite: AnimatedSprite;
    leftFootSprite: AnimatedSprite;
    rightFootSprite: AnimatedSprite;

    headTextures: PartData[] = [];
    bodyTexture: PartData[] = [];
    leftHandTextures: PartData[] = [];
    rightHandTextures: PartData[] = [];
    leftFootTextures: PartData[] = [];
    rightFootTextures: PartData[] = [];


    constructor(){
        super();
        const animationData = this.engine.getResource("player/run.json");
        const data: SavePlayerAnimation = animationData.data;

        this.frames = data.frameData.length;


        for(const frame of data.frameData){
            this.headTextures.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.head.canvas.color),frame.head.canvas.width,frame.head.canvas.height),
                x: frame.head.relativeX,
                y: frame.head.relativeY
            })

            this.bodyTexture.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.body.canvas.color),frame.body.canvas.width,frame.body.canvas.height),
                x: frame.body.relativeX,
                y: frame.body.relativeY
            })

            this.leftHandTextures.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.leftHand.canvas.color),frame.leftHand.canvas.width,frame.leftHand.canvas.height),
                x: frame.leftHand.relativeX,
                y: frame.leftHand.relativeY
            })

            this.rightHandTextures.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.rightHand.canvas.color),frame.rightHand.canvas.width,frame.rightHand.canvas.height),
                x: frame.rightHand.relativeX,
                y: frame.rightHand.relativeY
            })

            this.leftFootTextures.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.leftFoot.canvas.color),frame.leftFoot.canvas.width,frame.leftFoot.canvas.height),
                x: frame.leftFoot.relativeX,
                y: frame.leftFoot.relativeY
            })

            this.rightFootTextures.push({ 
                textures:Texture.fromBuffer(new Uint8Array(frame.rightFoot.canvas.color),frame.rightFoot.canvas.width,frame.rightFoot.canvas.height),
                x: frame.rightFoot.relativeX,
                y: frame.rightFoot.relativeY
            })
        }

        this.headSprite = new AnimatedSprite(this.headTextures.map(e => e.textures));
        this.bodySprite = new AnimatedSprite(this.bodyTexture.map(e => e.textures));
        this.leftHandSprite = new AnimatedSprite(this.leftHandTextures.map(e => e.textures));
        this.rightHandSprite = new AnimatedSprite(this.rightHandTextures.map(e => e.textures));
        this.leftFootSprite = new AnimatedSprite(this.leftFootTextures.map(e => e.textures));
        this.rightFootSprite = new AnimatedSprite(this.rightFootTextures.map(e => e.textures));
        console.log(this.bodySprite)
    }

    onAdd(){
        this.engine.renderer.addSprite(this.headSprite);
        this.engine.renderer.addSprite(this.bodySprite);
        this.engine.renderer.addSprite(this.leftHandSprite);
        this.engine.renderer.addSprite(this.rightHandSprite);
        this.engine.renderer.addSprite(this.leftFootSprite);
        this.engine.renderer.addSprite(this.rightFootSprite);
    }
    
    // Frames per animation tick
    private speed = 6;
    private tick = new TickTimer(this.speed, true);
    private frames = 0;
    
    
    update(dt: number): void {
        this.tick.tick()
        this.simpleMovement(2)
        const frame = this.tick.timesRepeated % this.frames;
        this.headSprite.x = this.headTextures[frame].x + this.x;
        this.headSprite.y = this.headTextures[frame].y + this.y;

        this.bodySprite.gotoAndStop(frame)
        this.bodySprite.x = this.bodyTexture[frame].x + this.x;
        this.bodySprite.y = this.bodyTexture[frame].y + this.y;

        this.leftHandSprite.gotoAndStop(frame);
        this.leftHandSprite.x = this.leftHandTextures[frame].x + this.x;
        this.leftHandSprite.y = this.leftHandTextures[frame].y + this.y;


        this.rightHandSprite.gotoAndStop(frame)
        this.rightHandSprite.x = this.rightHandTextures[frame].x + this.x;
        this.rightHandSprite.y = this.rightHandTextures[frame].y + this.y;



        this.leftFootSprite.gotoAndStop(frame)
        this.leftFootSprite.x = this.leftFootTextures[frame].x + this.x;
        this.leftFootSprite.y = this.leftFootTextures[frame].y + this.y;



        this.rightFootSprite.gotoAndStop(frame);
        this.rightFootSprite.x = this.rightFootTextures[frame].x + this.x;
        this.rightFootSprite.y = this.rightFootTextures[frame].y + this.y;
        
    }
    
}