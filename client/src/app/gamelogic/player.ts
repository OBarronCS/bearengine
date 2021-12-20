import { AnimatedSprite, Container, Graphics, Sprite, Texture } from "shared/graphics/graphics";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { ColliderPart } from "shared/core/entitycollision";
import { clamp, floor, lerp, PI, RAD_TO_DEG, sign } from "shared/misc/mathutils";
import { Line } from "shared/shapes/line";
import { dimensions } from "shared/shapes/rectangle";
import { drawCircle, drawCircleOutline, drawHealthBar, drawPoint } from "shared/shapes/shapedrawing";
import { angleBetween, Coordinate, rotatePoint, Vec2 } from "shared/shapes/vec2";
import { TickTimer } from "shared/datastructures/ticktimer";


import { DrawableEntity, Entity } from "../core-engine/entity";
import { RemoteLocations } from "../core-engine/networking/remotecontrol";
import { GraphicsPart, SpritePart } from "../core-engine/parts";
import { SavePlayerAnimation } from "./testlevelentities";

import { WeaponItem, ItemDrawer, UsableItem } from "../core-engine/clientitems";
import { EmitterAttach } from "../core-engine/particles";
import { PARTICLE_CONFIG } from "../../../../shared/core/sharedlogic/sharedparticles";
import { Effect } from "shared/core/effects";
import { random_range } from "shared/misc/random";
import { PhysicsDotEntity } from "./firstlevel";
import { NumberTween } from "shared/core/tween";
import { BoostDirection } from "./boostzone";
import { InterpolatedVar } from "../core-engine/networking/cliententitydecorators";



enum PlayerState {
    GROUND,
    AIR,
    CLIMB,
    WALL_SLIDE
}

export enum AnimationState {
    IDLE,
    RUN,
    WALL,
    CLIMB
}


interface PartData {
    textures: Texture;
    x: number,
    y: number
}

class PlayerAnimationState {
    
    public container: Container = new Container();
    public length: number;
    private timer: TickTimer;

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

    constructor(public data: SavePlayerAnimation, public framesPerTick: number, public originOffset = new Vec2(0,0)){
        this.timer = new TickTimer(this.framesPerTick, true);

        this.length = data.frameData.length;

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

        this.container.addChild(this.headSprite)
        this.container.addChild(this.headSprite);
        this.container.addChild(this.bodySprite);
        this.container.addChild(this.leftHandSprite);
        this.container.addChild(this.rightHandSprite);
        this.container.addChild(this.leftFootSprite);
        this.container.addChild(this.rightFootSprite);

        this.container.pivot.set(this.originOffset.x,this.originOffset.y);

        this.setFrame(0);
    }

    xFlip(value: number){
        if(value < 0){
            this.container.scale.x = -this.scale;
        } else if(value > 0){
            this.container.scale.x = this.scale
        }
    }

    private scale: number;

    setScale(value: number){
        this.scale = value;
        this.container.scale.x = value;
        this.container.scale.y = value;
    }

    move(dx: number,dy: number){
        this.container.position.x += dx;
        this.container.position.y += dy;
    }

    setPosition(pos: Coordinate){
        this.container.position.set(pos.x, pos.y);
    }

    tick(){
        if(this.timer.tick()){
            this.setFrame(this.timer.timesRepeated);
        }
    }

    setFrame(rawFrame: number){
        this.container.pivot.set(this.originOffset.x,this.originOffset.y);
        const frame = rawFrame % this.length;

        this.headSprite.gotoAndStop(frame);
        this.headSprite.x = this.headTextures[frame].x;
        this.headSprite.y = this.headTextures[frame].y;

        this.bodySprite.gotoAndStop(frame)
        this.bodySprite.x = this.bodyTexture[frame].x
        this.bodySprite.y = this.bodyTexture[frame].y

        this.leftHandSprite.gotoAndStop(frame);
        this.leftHandSprite.x = this.leftHandTextures[frame].x
        this.leftHandSprite.y = this.leftHandTextures[frame].y

        this.rightHandSprite.gotoAndStop(frame)
        this.rightHandSprite.x = this.rightHandTextures[frame].x
        this.rightHandSprite.y = this.rightHandTextures[frame].y

        this.leftFootSprite.gotoAndStop(frame)
        this.leftFootSprite.x = this.leftFootTextures[frame].x
        this.leftFootSprite.y = this.leftFootTextures[frame].y

        this.rightFootSprite.gotoAndStop(frame);
        this.rightFootSprite.x = this.rightFootTextures[frame].x
        this.rightFootSprite.y = this.rightFootTextures[frame].y
    }
}



export class Player extends DrawableEntity {

    private healthbar: Graphics;
    
    private readonly runAnimation = new PlayerAnimationState(this.engine.getResource("player/run.json").data as SavePlayerAnimation, 4, new Vec2(40,16));
    private readonly wallslideAnimation = new PlayerAnimationState(this.engine.getResource("player/wallslide.json").data as SavePlayerAnimation, 30, new Vec2(44,16));
    private readonly idleAnimation = new PlayerAnimationState(this.engine.getResource("player/idle.json").data as SavePlayerAnimation, 30, new Vec2(44,16));
    private readonly climbAnimation = new PlayerAnimationState(this.engine.getResource("player/climb.json").data as SavePlayerAnimation, 7, new Vec2(50,17));

    private ghost = false;
    health = 100;

    // Item graphics
    itemInHand: ItemDrawer = new ItemDrawer();
    
    usable_item: UsableItem<any> = null;

    setGhost(ghost: boolean){
        this.ghost = ghost;

        if(ghost){
            this.setAlpha(.2);
        } else {
            this.setAlpha(1);
        }
    }

    // What should the type that is taken in here be? hmm
    setItem(item: UsableItem<any>, path: string){
        this.itemInHand.setItem(path);
        
        this.usable_item = null;

        if(item instanceof UsableItem){
            this.usable_item = item
        } 
    }

    clearItem(){
        this.usable_item = null;
        this.itemInHand.clear();
    }

    last_ground_xspd = 0;
    last_ground_yspd = 0;

    yspd = 0;
    xspd = 0;

    gspd = 0;

    acc = 0.9;
    dec = 1.6;
    frc = 0.9
    top = 6;
    
    jump_power = -14;
    

    // Normal of the slope I'm making contact with. Is (0,-1) if in air
    slope_normal = new Vec2(0, -1);

    player_height: number = 48;
    player_width: number = 30;


    // For all of these: A in body, B is away from body
    leftHeadRay: Line;
    rightHeadRay: Line;

    downRayAdditionalLength = 6;
    leftDownRay: Line;
    midDownRay: Line;
    rightDownRay: Line;

    

    wallSensorLength = 16 + 5;
    rightWallRay: Line;
    leftWallRay: Line;

    slideSensorLength = this.wallSensorLength + 16;

    climbSensorLength = this.wallSensorLength + 5;
    
    rightClimbRay: Line = new Line(new Vec2(0,0), new Vec2(0,0));
    leftClimbRay: Line = new Line(new Vec2(0,0), new Vec2(0,0));
    


    private readonly timeToClimb = 26;
    climbStateData: {
        // Climbing to the right? false means left
        right: boolean;
        targetX: number, //
        targetY: number, // where buttom of sensors will be when finish climbing
        climbingTimer: number;
        startX: number,
        startY: number,
    }

    private readonly timeToSlide = 35; // How many ticks can hold in place until start falling
    slideStateData: {
        right: boolean; 
        timeSliding: number
    }

    state = PlayerState.AIR;
    last_state = PlayerState.GROUND;

    animation_state = AnimationState.IDLE;
    
    
    // If both these values are >= 0, and the player is on the ground, the player will jump
    // Used for coyote time
    private ticksSinceGroundState = 100000;
    private timeSincePressedJumpedButton = 10000;

    private readonly COYOTE_TIME = 4;
    private readonly timeSincePressedAllowed = 10;

    private colliderPart: ColliderPart;


  

    constructor(){
        super();

        this.position.set({x : 500, y: 100});

        
        this.colliderPart = new ColliderPart(dimensions(32,32),{x:16, y:16});
        this.addPart(this.colliderPart);
        
        
        const {x, y} = this.position;


        this.leftHeadRay = new Line(new Vec2(0,0), new Vec2(0,0));
        this.rightHeadRay = new Line(new Vec2(0,0), new Vec2(0,0))

        this.leftDownRay = new Line(new Vec2(x - this.player_width / 2,y), new Vec2(x - this.player_width / 2,y - this.player_height / 2));
        this.rightDownRay = new Line(new Vec2(x + this.player_width / 2,y), new Vec2(x + this.player_width / 2,y - this.player_height / 2));
        this.midDownRay = new Line(new Vec2(0,0), new Vec2(0,0));

        this.rightWallRay = new Line(new Vec2(x, y), new Vec2(3 + x + this.player_width / 2,y));
        this.leftWallRay = new Line(new Vec2(x, y), new Vec2(-3 + x - this.player_width / 2, y));
    }

    override onAdd(){
        this.healthbar = this.engine.renderer.createGUICanvas();


        this.scene.addEntity(this.itemInHand);

        this.runAnimation.setScale(2);
        this.wallslideAnimation.setScale(2);
        this.idleAnimation.setScale(2);
        this.climbAnimation.setScale(2);

        this.engine.renderer.addSprite(this.runAnimation.container);
        this.engine.renderer.addSprite(this.wallslideAnimation.container);
        this.engine.renderer.addSprite(this.idleAnimation.container)
        this.engine.renderer.addSprite(this.climbAnimation.container)

        this.setAnimationSprite(AnimationState.RUN);
    }

    override onDestroy(){
        this.healthbar.destroy();

        this.scene.destroyEntity(this.itemInHand)
        this.engine.renderer.removeSprite(this.runAnimation.container);
        this.engine.renderer.removeSprite(this.wallslideAnimation.container);
        this.engine.renderer.removeSprite(this.idleAnimation.container);
        this.engine.renderer.removeSprite(this.climbAnimation.container);
    }

    private setAlpha(a: number): void {
        this.runAnimation.container.alpha = a;
        this.wallslideAnimation.container.alpha = a;
        this.idleAnimation.container.alpha = a;
        this.climbAnimation.container.alpha = a;
    }

    private setAnimationSprite(state: AnimationState){
        this.animation_state = state
        this.runAnimation.container.visible = false;
        this.runAnimation.setPosition(this.position)

        this.wallslideAnimation.container.visible = false;
        this.wallslideAnimation.setPosition(this.position);

        this.idleAnimation.container.visible = false;
        this.idleAnimation.setPosition(this.position);

        this.climbAnimation.container.visible = false;
        this.climbAnimation.setPosition(this.position)

        switch(state){
            case AnimationState.RUN: { 
                this.runAnimation.container.visible = true; 
                
                break; }
            case AnimationState.WALL: this.wallslideAnimation.container.visible = true; break;
            case AnimationState.IDLE: this.idleAnimation.container.visible = true; break;
            case AnimationState.CLIMB: { 
                if(!this.climbStateData.right){
                    this.climbAnimation.originOffset.x = 63
                } else {
                    this.climbAnimation.originOffset.x = 50;
                }
                this.climbAnimation.xFlip(this.climbStateData.right ? 1 : -1)
                this.climbAnimation.container.visible = true; break; 
            }
            default: AssertUnreachable(state);
        }
    }
    
    private setSensorLocationsAndRotate(){
        this.setSensorLocations();

        // Ground sensors
        rotatePoint(this.leftDownRay.A,this.position,this.slope_normal);
        rotatePoint(this.leftDownRay.B,this.position,this.slope_normal);

        rotatePoint(this.rightDownRay.A,this.position,this.slope_normal);
        rotatePoint(this.rightDownRay.B,this.position,this.slope_normal);

        // Head rays
        rotatePoint(this.leftHeadRay.A,this.position,this.slope_normal);
        rotatePoint(this.leftHeadRay.B,this.position,this.slope_normal);

        rotatePoint(this.rightHeadRay.A,this.position,this.slope_normal);
        rotatePoint(this.rightHeadRay.B,this.position,this.slope_normal);

        // LEFT AND RIGHT sensors
        rotatePoint(this.rightWallRay.B,this.position,this.slope_normal);
        rotatePoint(this.leftWallRay.B,this.position,this.slope_normal);
    }

    private setSensorLocations(){
        //FEET RAYS
        this.leftDownRay.A.set({x: this.x - this.player_width / 2,y:this.y});
        this.leftDownRay.B.set({x: this.x - this.player_width / 2,y: this.downRayAdditionalLength + this.y + this.player_height / 2});

        this.rightDownRay.A.set({x: this.x + this.player_width / 2,y:this.y});
        this.rightDownRay.B.set({x: this.x + this.player_width / 2,y: this.downRayAdditionalLength + this.y + this.player_height / 2});


        this.midDownRay.A.set(this.position);
        this.midDownRay.B.set({x: this.x, y: this.downRayAdditionalLength + this.y + this.player_height / 2});

        //HEAD ray
        this.leftHeadRay.A.set({x: this.x - this.player_width / 2,y:this.y});
        this.leftHeadRay.B.set({x: this.x - this.player_width / 2,y: -this.downRayAdditionalLength + this.y - this.player_height / 2});
        
        this.rightHeadRay.A.set({x: this.x + this.player_width / 2,y:this.y});
        this.rightHeadRay.B.set({x: this.x + this.player_width / 2,y: -this.downRayAdditionalLength + this.y - this.player_height / 2});

        // LEFT AND RIGHT sensors
        this.rightWallRay.A.set(this.position)
        this.rightWallRay.B.set({x: this.x + this.wallSensorLength,y:this.y});

        this.leftWallRay.A.set(this.position);
        this.leftWallRay.B.set({x: this.x - this.wallSensorLength, y:this.y});

        // Climbing rays --> used to climb on ledge, and wall collision at head level
        this.rightClimbRay.A.set({x:this.x, y:this.y - this.player_height / 2});
        this.rightClimbRay.B.set({x: this.x + this.climbSensorLength,y:this.y - this.player_height / 2});

        this.leftClimbRay.A.set({x:this.x, y:this.y - this.player_height / 2});
        this.leftClimbRay.B.set({x: this.x - this.climbSensorLength, y:this.y - this.player_height / 2});
    }

    // Sets both climb and wall sensor to the same width;
    private setWallSensorsEven(length = this.wallSensorLength){
        // LEFT AND RIGHT sensors
        this.rightWallRay.A.set(this.position)
        this.rightWallRay.B.set({x: this.x + length,y:this.y});

        this.leftWallRay.A.set(this.position);
        this.leftWallRay.B.set({x: this.x - length, y:this.y});

        // Climbing rays --> used to climb on ledge, and wall collision at head level
        this.rightClimbRay.A.set({x:this.x, y:this.y - this.player_height / 2});
        this.rightClimbRay.B.set({x: this.x + length,y:this.y - this.player_height / 2});

        this.leftClimbRay.A.set({x:this.x, y:this.y - this.player_height / 2});
        this.leftClimbRay.B.set({x: this.x - length, y:this.y - this.player_height / 2});
    }

    /** If not collision to terrain, return bottom of bot ray, not rotated */
    private getFeetCollisionPoint():{ point: Vec2, normal: Vec2, collision: boolean} {
        // The player has already moved at this point
        const leftRay = this.game.terrain.lineCollision(this.leftDownRay.A, this.leftDownRay.B);
        const rightRay = this.game.terrain.lineCollision(this.rightDownRay.A, this.rightDownRay.B);
        const midRay = this.game.terrain.lineCollision(this.midDownRay.A, this.midDownRay.B);

        const tempWinningRay = (leftRay === null && rightRay === null) ? null : 
                            (leftRay === null) ? rightRay : 
                            (rightRay === null) ? leftRay :
                            leftRay.point.y < rightRay.point.y ? leftRay : rightRay;
            
        const winningRay = (tempWinningRay === null && midRay === null) ? null : 
                        (tempWinningRay === null) ? midRay : 
                        (midRay === null) ? tempWinningRay :
                        tempWinningRay.point.y < midRay.point.y ? tempWinningRay : midRay;

        if(winningRay !== null){
            return {
                collision: true,
                ...winningRay
            }
        } else {
            return {
                collision : false,
                point : new Vec2(this.position.x, this.position.y + this.player_height / 2),
                normal : new Vec2(0,-1),
            }
        }
    }

    /** If not collision to terrain, return bottom of bot ray, not rotated */
    private getHeadCollisionPoint():{ point: Vec2, normal: Vec2, collision: boolean} {
        // The player has already moved at this point
        const leftRay = this.game.terrain.lineCollision(this.leftHeadRay.A, this.leftHeadRay.B);
        const rightRay = this.game.terrain.lineCollision(this.rightHeadRay.A, this.rightHeadRay.B);
        
        const winningRay = (leftRay === null && rightRay === null) ? null : 
                            (leftRay === null) ? rightRay : 
                            (rightRay === null) ? leftRay :
                             leftRay.point.y > rightRay.point.y ? leftRay : rightRay;

        if(winningRay !== null){
            return {
                collision: true,
                ...winningRay
            }
        } else {
            return {
                point : new Vec2(this.position.x, this.position.y + this.player_height / 2),
                normal : new Vec2(0,-1),
                collision : false
            }
        }
    }

    /** return nearest point of intersection, else collision = false */
    private getRightWallCollisionPoint():{ point: Vec2, normal: Vec2, collision: boolean, both: boolean } {
        const waistRay = this.game.terrain.lineCollision(this.rightWallRay.A, this.rightWallRay.B);
        const climbRay = this.game.terrain.lineCollision(this.rightClimbRay.A, this.rightClimbRay.B);
        
        const winningRay = (waistRay === null && climbRay === null) ? null : 
                            (waistRay === null) ? climbRay : 
                            (climbRay === null) ? waistRay :
                            waistRay.point.x > climbRay.point.x ? waistRay : climbRay;

        const both = (waistRay !== null && climbRay !== null);

        if(winningRay !== null){
            return {
                collision: true,
                both,
                ...winningRay
            }
        } else {
            return {
                collision : false,
                both,
                point : new Vec2(this.position.x, this.position.y + this.player_height / 2),
                normal : new Vec2(0,-1),
            }
        }
    }

    /** return nearest point of intersection, else collision = false */
    private getLeftWallCollisionPoint():{ point: Vec2, normal: Vec2, collision: boolean, both: boolean } {
        const waistRay = this.game.terrain.lineCollision(this.leftWallRay.A, this.leftWallRay.B);
        const climbRay = this.game.terrain.lineCollision(this.leftClimbRay.A, this.leftClimbRay.B);
        
        const winningRay = (waistRay === null && climbRay === null) ? null : 
                            (waistRay === null) ? climbRay : 
                            (climbRay === null) ? waistRay :
                            waistRay.point.x > climbRay.point.x ? waistRay : climbRay;

        const both = (waistRay !== null && climbRay !== null);

        if(winningRay !== null){
            return {
                collision: true,
                both,
                ...winningRay
            }
        } else {
            return {
                both,
                point : new Vec2(this.position.x, this.position.y + this.player_height / 2),
                normal : new Vec2(0,-1),
                collision : false
            }
        }
    }

    private followCam = false;

    update(dt: number): void {
    }

    manualUpdate(dt: number): void {
        // Lock camera on me
        if(this.keyboard.wasPressed("KeyC")){
            this.followCam = !this.followCam;
            if(this.followCam){
                this.engine.camera.follow(this.position);
            } else {
                this.engine.camera.free();
            }
        }
        
        if(this.keyboard.wasPressed("KeyP")){
            this.position.set({x : 600, y: 100});
        }

        const health_width = 500;
        const health_height = 40;
        const x = this.engine.renderer.getPercentWidth(.5) - (health_width / 2);
        const y = this.engine.renderer.getPercentHeight(0) + 20// - 60;

        this.healthbar.clear();
        
        if(!this.ghost) {
            drawHealthBar(this.healthbar, x, y, health_width, health_height, this.health / 100, 1);
        }

        
    
        if(this.y > this.level.bbox.height + 800) this.y = 0;


        // Weapon logic
        this.itemInHand.position.set({x: this.x, y: this.y});
        rotatePoint(this.itemInHand.position,this.position,this.slope_normal);

        const angleToMouse = angleBetween(this.itemInHand.position, this.mouse.position);
        
        const difference = Vec2.subtract(this.mouse.position, this.itemInHand.position);

        if(difference.x > 0){
            this.itemInHand.image.sprite.scale.x = 1;
            this.itemInHand.image.angle = angleToMouse;
        } else {
            this.itemInHand.image.sprite.scale.x = -1;
            this.itemInHand.image.angle = angleToMouse + PI;
        }
        
        if(this.usable_item !== null){
            if(!this.usable_item.consumed){
                const consumed = this.usable_item.operate(dt, this.position, this.mouse.position, this.mouse.isDown("left"), this.game, this);
                this.usable_item.consumed = consumed;
            }
        } 

        // if(this.itemInHand.operate(this.mouse.isDown("left"))){
        //     if(this.state === PlayerState.GROUND) this.state = PlayerState.AIR;

        //     if(this.state === PlayerState.AIR) this.knockback(kb);
            
        //     // else if (this.state === PlayerState.GROUND) {
        //     //     this.gspd += -kb.x * this.slope_normal.y
        //     //     this.gspd += kb.y * this.slope_normal.x
        //     // }
        // }

        // Adjust drawing angle 
        const angle = Math.atan2(this.slope_normal.y, this.slope_normal.x) * RAD_TO_DEG;

        if(this.keyboard.wasPressed("KeyW")) this.timeSincePressedJumpedButton = 0;

        const zone = this.game.collisionManager.first_tagged_collider_on_point(this.position, "BoostZone");
        if(zone){
            const dir = zone.owner.getAttribute(BoostDirection).dir;
            this.xspd += dir.x;
            this.yspd += dir.y;

        }

        
        switch(this.state){
            case PlayerState.AIR: this.Air_State(); break;
            case PlayerState.GROUND: this.Ground_State(); break;
            case PlayerState.CLIMB: this.Climb_State(); break;
            case PlayerState.WALL_SLIDE: this.Wall_Slide_State(); break;
            default: AssertUnreachable(this.state)
        }
        
        this.timeSincePressedJumpedButton++;


        this.redraw();
    }

    knockback(dir: Coordinate){
        this.xspd += dir.x;
        this.yspd += dir.y;
    }

    private Climb_State(): void {
        const fraction = this.climbStateData.climbingTimer++ / this.timeToClimb;

        // console.log(fraction);

        this.x = this.climbStateData.targetX - this.player_width / 2;
        this.y = this.climbStateData.targetY - this.player_height / 2;

        if(!this.climbStateData.right){
            this.climbAnimation.originOffset.x = 63
        } else {
            this.climbAnimation.originOffset.x = 50;
        }


        this.climbAnimation.setFrame(floor(fraction * this.climbAnimation.length));
        this.climbAnimation.setPosition(this.position);
        this.climbAnimation.xFlip(this.climbStateData.right ? 1 : -1)

        if(this.climbStateData.climbingTimer > this.timeToClimb){
            this.setAnimationSprite(AnimationState.IDLE);
            this.state = PlayerState.GROUND;
            this.gspd = 0;
        }
    }

    private wallSlideNormalIsValid(normal: Vec2): boolean {
        return (-.44 < normal.y) && (normal.y < .25);
    }

    private doRightSlideSensorsHit(): boolean {
        this.setWallSensorsEven(this.slideSensorLength);
        return this.getRightWallCollisionPoint().collision;
    }

    private doLeftSlideSensorsHit(): boolean {
        this.setWallSensorsEven(this.slideSensorLength);
        return this.getLeftWallCollisionPoint().collision;
    }

    private Wall_Slide_State(): void {
        this.slideStateData.timeSliding++;

        this.wallslideAnimation.setPosition(this.position);
        this.wallslideAnimation.tick();
        this.wallslideAnimation.xFlip(this.slideStateData.right ? 1 : -1);

        // Wall jump
        if(this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed){
            this.state = PlayerState.AIR;
            this.yspd = -14
            this.xspd = this.slideStateData.right ? -9 : 9;
            this.timeSincePressedJumpedButton = 10000;

            this.setAnimationSprite(AnimationState.RUN)

            return;
        }

        

        //while below timer, slow yspd to 0
        if(this.slideStateData.timeSliding < this.timeToSlide){
            this.yspd = lerp(this.yspd,0,.3);
        } else {
            this.yspd = lerp(this.yspd,3.6,.1);
        }

        this.y += this.yspd;

        let myWallNormal: Vec2;

        // Slide down wall
        this.setWallSensorsEven(this.slideSensorLength);

        if(this.slideStateData.right){
            const rightWall = this.getRightWallCollisionPoint();
            
            if(rightWall.collision){
                if(!this.wallSlideNormalIsValid(rightWall.normal)){
                    console.log("To Steep")
                    this.state = PlayerState.AIR;
                    this.xspd = 0;
                    this.setAnimationSprite(AnimationState.RUN)
                    return;
                } 
                
                this.x = rightWall.point.x - this.wallSensorLength;
                myWallNormal = rightWall.normal;
            } 

            if(!rightWall.both){
                this.state = PlayerState.AIR;
                this.yspd = 2;
                this.xspd = 0;
                this.setAnimationSprite(AnimationState.RUN);
            }
        } else {
            const leftWall = this.getLeftWallCollisionPoint();
            
            if(leftWall.collision){
                if(!this.wallSlideNormalIsValid(leftWall.normal)){
                    console.log("To Steep")
                    this.state = PlayerState.AIR;
                    this.xspd = 0;
                    this.setAnimationSprite(AnimationState.RUN);
                    return;
                } 
                this.x = leftWall.point.x + this.wallSensorLength;
                myWallNormal = leftWall.normal;
            }

            if(!leftWall.both){
                this.state = PlayerState.AIR;
                this.xspd = 0;
                this.setAnimationSprite(AnimationState.RUN);
            }
        }
        

        this.setSensorLocations();
        const ground = this.getFeetCollisionPoint();
        // Hit ground, snap to it!
        if(ground.collision){

            // Ignore collision if its with same wall we are sliding against
            if(myWallNormal !== undefined && myWallNormal.equals(ground.normal)) return;

            this.position.y = ground.point.y - this.player_height / 2

            this.slope_normal.set(ground.normal);

            this.state = PlayerState.GROUND;
            this.setAnimationSprite(AnimationState.RUN)
            // Set GSPD here
            // this.gspd = this.yspd * this.slope_normal.x
            // this.gspd = this.xspd * -this.slope_normal.y
            this.gspd = 0;
            this.yspd = 0;
            this.xspd = 0;
        }

    }

    private Ground_State(): void {
    
        this.ticksSinceGroundState = 0;
        this.last_ground_xspd = this.xspd;
        this.last_ground_yspd = this.yspd;

        const horz_move = +this.keyboard.isDown("KeyD") - +this.keyboard.isDown("KeyA");


        // Set ground speed
        if (horz_move === -1) { // Left
            if (this.gspd > 0) {
                this.gspd -= this.dec;
            } else if (this.gspd > -this.top) {
                this.gspd -= this.acc;
                if (this.gspd <= -this.top)
                    this.gspd = -this.top;
            }
        } else if (horz_move === 1) { // Right
            if (this.gspd < 0) {
                this.gspd += this.dec;
            } else if (this.gspd < this.top) {
                this.gspd += this.acc;
                if (this.gspd >= this.top)
                    this.gspd = this.top;
            }
        } else {
            this.gspd -= Math.min(Math.abs(this.gspd), this.frc) * Math.sign(this.gspd);
        }
        
        // If going too fast, slowdown to top speed
        if(Math.abs(this.gspd) > this.top){
            this.gspd -= Math.min(Math.abs(this.gspd), this.frc) * Math.sign(this.gspd);
        }
        
        this.xspd = this.gspd*-this.slope_normal.y;
        this.yspd = this.gspd*this.slope_normal.x;

        // Before moving, check walls
        const gdir = sign(this.gspd);

        //If going right. The dot product tests the difference in normals, makes sure doesn't go into too steep terrain

        this.setWallSensorsEven();
        

        if(gdir > 0){
            this.rightWallRay.B.x += this.xspd;
            this.rightClimbRay.B.x += this.xspd
            const rightWall = this.getRightWallCollisionPoint();

            // If hit wall, adjust speed so don't hit wall
            if(rightWall.collision){ //  || Vec2.dot(wall_test.normal, this.slope_normal) > .3
                // this.rightWalRay.B.x is the same as climbRay. Maybe make it another variable
                const distanceInWall = this.rightWallRay.B.x - rightWall.point.x;
                this.xspd -= distanceInWall;
                this.gspd = 0;
            }
        } else if(gdir < 0) {
            this.leftWallRay.B.x += this.xspd;
            this.leftClimbRay.B.x += this.xspd

            const leftWall = this.getLeftWallCollisionPoint();

            if(leftWall.collision){
                const distanceInWall = leftWall.point.x - this.leftWallRay.B.x;
                this.xspd += distanceInWall;
                this.gspd = 0;
            }
        }

        // Move player
        this.position.x += this.xspd;
        this.position.y += this.yspd;

        // Now that player has moved, clamp them to the ground
        this.setSensorLocations();
        const downray = this.getFeetCollisionPoint();

        if(downray.collision){
            if(!this.wallSlideNormalIsValid(downray.normal)){

                this.position.y = downray.point.y - (this.player_height / 2);

                this.slope_normal.set(downray.normal);
            } else {
                // Hit ground for wall slide
                this.state = PlayerState.AIR;
            }
        } else {
            this.state = PlayerState.AIR;
        }


        if(this.gspd === 0) this.setAnimationSprite(AnimationState.IDLE);
        else this.setAnimationSprite(AnimationState.RUN);

        this.idleAnimation.setPosition(this.position);
        this.idleAnimation.tick();
        this.idleAnimation.xFlip(horz_move);
                
        this.runAnimation.setPosition(this.position);
        this.runAnimation.tick();
        this.runAnimation.xFlip(horz_move);

        // Check for jumping
        const jumpButtonDown = this.keyboard.isDown("KeyW");
        
        // JUMP
        if(jumpButtonDown || (this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed)){
            //yspd = jump_power;
            // this.xspd = this.last_ground_xspd - this.jump_power * this.slope_normal.x;
            this.yspd = /** this.last_ground_yspd + */ this.jump_power // * this.slope_normal.y;
            
            this.timeSincePressedJumpedButton = 10000;

            this.setAnimationSprite(AnimationState.RUN);

            this.gspd = 0;
            this.state = PlayerState.AIR;
            this.slope_normal.set({ x: 0, y: -1});
            return;
        }
    }
     
    private Air_State(): void {
        this.idleAnimation.setPosition(this.position);

        if(this.xspd !== 0) this.setAnimationSprite(AnimationState.RUN)
        this.runAnimation.setPosition(this.position);
        this.runAnimation.tick();
        this.runAnimation.xFlip(this.xspd)
        
        // gravity
        this.ticksSinceGroundState += 1;

        if(this.ticksSinceGroundState <= this.COYOTE_TIME){
            if(this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed){
                this.timeSincePressedJumpedButton = 10000;
                // this.xspd = this.last_ground_xspd - this.jump_power * this.slope_normal.x;
                this.yspd = /** this.last_ground_yspd + */ this.jump_power // * this.slope_normal.y;
            }
        }

        const grav = 1.2;
        const horz_move = +this.keyboard.isDown("KeyD") - +this.keyboard.isDown("KeyA");   

        if (horz_move == -1) {
            if (this.xspd > 0) {
                this.xspd -= this.dec;
            } else if (this.xspd > -this.top) {
                this.xspd -= this.acc;
                if (this.xspd <= -this.top)
                    this.xspd = -this.top;
            }
        } else if (horz_move == 1) {
            if (this.xspd < 0) {
                this.xspd += this.dec;
            } else if (this.xspd < this.top) {
                this.xspd += this.acc;
                if (this.xspd >= this.top)
                    this.xspd = this.top;
            }
        } else {
            this.xspd -= Math.min(Math.abs(this.xspd), this.frc/7) * Math.sign(this.xspd);
        }
        
        // This implies that sideways is the default left and right --> have to rethink the jumping mechanics of sides to side ..
        // Maybe make the loop-de-loop a special case and a special walltypes

        // Drag
        if(Math.abs(this.xspd) > this.top){
            this.xspd -= Math.min(Math.abs(this.xspd), this.frc/7) * Math.sign(this.xspd);
        }
        
        // Gravity
        if(Math.sign(this.yspd) >= 0){
            this.yspd += .7 * grav
        } else {
            this.yspd += .65 * grav;
        }
        
        // Clamp yspd
        this.yspd = clamp(this.yspd, -100, 20);

        const xdir = sign(this.xspd);
        const ydir = sign(this.yspd);
        
        // In air, collision checking is different than on ground.
        // First MOVE player, then snap player out of walls
        this.position.x += this.xspd;
        this.position.y += this.yspd;


        // WALLS, and wall sliding
        this.setWallSensorsEven();
        if(xdir > 0){
            const rightWall = this.getRightWallCollisionPoint();
            
            if(rightWall.collision){
                this.x = rightWall.point.x - this.wallSensorLength;

                if(rightWall.both && this.wallSlideNormalIsValid(rightWall.normal)){
                    if(ydir > 0){
                        this.state = PlayerState.WALL_SLIDE;
                        this.slideStateData = {
                            right: true,
                            timeSliding: 0
                        }
                        this.setAnimationSprite(AnimationState.WALL);
                        return;
                    }
                }
            } 
        } else if(xdir < 0) {
            const leftWall = this.getLeftWallCollisionPoint();
            
            if(leftWall.collision){
                this.x = leftWall.point.x + this.wallSensorLength;

                if(leftWall.both && this.wallSlideNormalIsValid(leftWall.normal)){
                    if(ydir > 0){
                        this.state = PlayerState.WALL_SLIDE;
                        this.slideStateData = {
                            right: false,
                            timeSliding: 0
                        }
                        this.setAnimationSprite(AnimationState.WALL);
                        return;
                    }
                }
            }
        }

        // CLIMBING
        this.setSensorLocations();
        if(horz_move > 0){
            const climbTest = this.game.terrain.lineCollision(this.rightClimbRay.A, this.rightClimbRay.B);
                
            if(climbTest === null){

                this.rightClimbRay.B.x += 8;

                const targetPoint = this.game.terrain.lineCollision(this.rightClimbRay.B, this.rightClimbRay.B.clone().add({x:0,y:this.player_height / 2}));
                if(targetPoint !== null){
                    if(targetPoint.normal.y < -.8){
                        this.climbStateData = {
                            right:true,
                            climbingTimer:0,
                            targetX: targetPoint.point.x + 3,
                            targetY: targetPoint.point.y,
                            startX:this.x,
                            startY:this.y
                        }

                        this.state = PlayerState.CLIMB;

                        this.x = this.climbStateData.targetX - this.player_width / 2;
                        this.y = this.climbStateData.targetY - this.player_height / 2;

                        this.setAnimationSprite(AnimationState.CLIMB)
                        return;
                    }
                }
            }
        } else if(horz_move < 0){
            // left
            const climbTest = this.game.terrain.lineCollision(this.leftClimbRay.A, this.leftClimbRay.B);
                
            if(climbTest === null){

                this.leftClimbRay.B.x -= 8;

                const targetPoint = this.game.terrain.lineCollision(this.leftClimbRay.B, this.leftClimbRay.B.clone().add({x:0,y:this.player_height / 2}));
                if(targetPoint !== null){
                    if(targetPoint.normal.y < -.8){
                        this.climbStateData = {
                            right:false,
                            climbingTimer:0,
                            targetX: targetPoint.point.x - 3,
                            targetY: targetPoint.point.y,
                            startX:this.x,
                            startY:this.y
                        }

                        this.x = this.climbStateData.targetX - this.player_width / 2;
                        this.y = this.climbStateData.targetY - this.player_height / 2;

                        this.state = PlayerState.CLIMB;
                        this.setAnimationSprite(AnimationState.CLIMB);
                        return;
                    }
                }
            }
        }

        // UP AND DOWN
        this.setSensorLocations();
        if(ydir < 0){
            const headTest = this.getHeadCollisionPoint();

            if(headTest.collision === true){
                // Hit head!
                this.yspd = 0;
                this.position.y = headTest.point.y + this.player_height / 2;
            }
        } else if (ydir > 0){ 
            // going down
            
            const ray = this.getFeetCollisionPoint();

            // Hit ground, snap to it!
            if(ray.collision){                
                // Hitting ground that is valid for ground sliding
                const right = ray.normal.x < 0;
                const wallsensors = right ? this.doRightSlideSensorsHit() : this.doLeftSlideSensorsHit();

                if(this.wallSlideNormalIsValid(ray.normal)){
                    if(wallsensors){
                        this.state = PlayerState.WALL_SLIDE;
                        this.slideStateData = {
                            right,
                            timeSliding: 0
                        }
                        this.setAnimationSprite(AnimationState.WALL);
                    } 
                } else {
                    this.position.y = ray.point.y - this.player_height / 2

                    this.slope_normal.set(ray.normal);

                    this.state = PlayerState.GROUND
                    this.setAnimationSprite(AnimationState.RUN);
                    // Set GSPD here
                    // this.gspd = this.yspd * this.slope_normal.x
                    this.gspd = this.xspd * -this.slope_normal.y

                    this.yspd = 0;
                    this.xspd = 0;
                }
            }
        }

    }

    draw(g: Graphics){
        // drawCircleOutline(g, this.position, 50)
        
        drawPoint(g,this.position);

        // g.beginFill(0xFF00FF,.4)
        // g.drawRect(this.x - this.player_width / 2, this.y - this.player_height / 2, this.player_width, this.player_height)
        // g.endFill();

        // this.rightWallRay.draw(g, 0x00FF00);
        // this.leftWallRay.draw(g);

        // this.leftDownRay.draw(g,0xFF0000);
        // this.rightDownRay.draw(g, 0xFF00FF);
        // this.midDownRay.draw(g, 0x0FF00F)

        // this.leftHeadRay.draw(g, 0x00FFFF);
        // this.rightHeadRay.draw(g, 0xFFFF00);

        // this.leftClimbRay.draw(g,0x00000)
        // this.rightClimbRay.draw(g, 0xFFFFFF)
        if(!this.ghost)
            drawHealthBar(g, this.x - 20, this.y - 40, 40, 7, this.health / 100, 1);
    }
}




export class RemotePlayer extends Entity {

    // colliderPart = this.addPart(new ColliderPart(dimensions(48,30),{x:24, y:15}));
    readonly id: number;
    public health = 100;

    private ghost = false;

    draw_item: ItemDrawer = new ItemDrawer();

    graphics = this.addPart(new GraphicsPart());
    locations = this.addPart(new RemoteLocations());

    /** Normalized direction vector */
    look_angle = InterpolatedVar(new Vec2(1))

    constructor(id: number){
        super();
        this.id = id;
    }
    
    private readonly runAnimation = new PlayerAnimationState(this.engine.getResource("player/run.json").data as SavePlayerAnimation, 4, new Vec2(40,16));
    private readonly wallslideAnimation = new PlayerAnimationState(this.engine.getResource("player/wallslide.json").data as SavePlayerAnimation, 30, new Vec2(44,16));
    private readonly idleAnimation = new PlayerAnimationState(this.engine.getResource("player/idle.json").data as SavePlayerAnimation, 30, new Vec2(44,16));
    private readonly climbAnimation = new PlayerAnimationState(this.engine.getResource("player/climb.json").data as SavePlayerAnimation, 7, new Vec2(50,17));

    update(dt: number): void {

        this.draw_item.position.set({x: this.x, y: this.y});
        this.draw_item.image.angle = this.look_angle.value.angle();

        this.runAnimation.setPosition(this.position);
        this.wallslideAnimation.setPosition(this.position);
        this.idleAnimation.setPosition(this.position);
        this.climbAnimation.setPosition(this.position);

        this.look_angle.value.set(this.look_angle.buffer.getValue(this.game.networksystem["getServerTickToSimulate"]()))

        if(!this.ghost){
            this.runAnimation.tick();
            this.wallslideAnimation.tick();
            this.idleAnimation.tick();
            this.climbAnimation.tick();

            this.graphics.graphics.clear();
            drawHealthBar(this.graphics.graphics, this.x - 20, this.y - 40, 40, 7, this.health / 100);
        }
    }

    setGhost(ghost: boolean){
        this.ghost = ghost;

        if(ghost){
            this.graphics.graphics.clear();

            this.runAnimation.container.visible = false;
            this.wallslideAnimation.container.visible = false;
            this.idleAnimation.container.visible = false;
            this.climbAnimation.container.visible = false;

            this.scene.addEntity(new EmitterAttach(this,"BOOM", "particle.png"));
            const {
                headSprite,
                bodySprite,
                leftHandSprite,
                rightHandSprite, 
                leftFootSprite,
                rightFootSprite
            } = this.idleAnimation;


            const iter = [
                headSprite,
                bodySprite,
                leftHandSprite,
                rightHandSprite,
                leftFootSprite,
                rightFootSprite
            ]

            
            for(const i of iter){
                const spr = new Sprite(i.texture);
                spr.scale.set(2,2);

                const e = new PhysicsDotEntity(this.engine.mouse, spr);

                e.position.set(this.position);

                e.velocity.set(new Vec2(random_range(-20, 20), random_range(-20, 20)));
                this.game.entities.addEntity(e);
                
                
                this.scene.addEntity(e);

                const tween = new NumberTween(e["sprite"],"alpha",6).from(1).to(.1).go();

                // tween.easingfunction
                tween.delay(2)

                tween.onFinish(() => {
                    e.destroy();
                });

                this.scene.addEntity(tween);
            }
            
            
        } else {
            this.runAnimation.container.visible = true;
            this.wallslideAnimation.container.visible = true;
            this.idleAnimation.container.visible = true;
            this.climbAnimation.container.visible = true;
        }
    }

    override onAdd(){
        // this.scene.addEntity(this.gun)
        this.runAnimation.setScale(2);
        this.wallslideAnimation.setScale(2);
        this.idleAnimation.setScale(2);
        this.climbAnimation.setScale(2);

        this.engine.renderer.addSprite(this.runAnimation.container);
        this.engine.renderer.addSprite(this.wallslideAnimation.container);
        this.engine.renderer.addSprite(this.idleAnimation.container);
        this.engine.renderer.addSprite(this.climbAnimation.container);

        this.scene.addEntity(this.draw_item);
    }

    override onDestroy(){
        // this.scene.destroyEntity(this.gun)
        this.engine.renderer.removeSprite(this.runAnimation.container);
        this.engine.renderer.removeSprite(this.wallslideAnimation.container);
        this.engine.renderer.removeSprite(this.idleAnimation.container);
        this.engine.renderer.removeSprite(this.climbAnimation.container);
        this.scene.destroyEntity(this.draw_item);
    }

    setState(state: AnimationState, flipped: boolean){
    
        this.runAnimation.xFlip(flipped ? -1 : 1);
        this.wallslideAnimation.xFlip(flipped ? -1 : 1);
        this.idleAnimation.xFlip(flipped ? -1 : 1);
        this.climbAnimation.xFlip(flipped ? -1 : 1);
        


        this.runAnimation.container.visible = false;
        this.runAnimation.setPosition(this.position)

        this.wallslideAnimation.container.visible = false;
        this.wallslideAnimation.setPosition(this.position);

        this.idleAnimation.container.visible = false;
        this.idleAnimation.setPosition(this.position);

        this.climbAnimation.container.visible = false;
        this.climbAnimation.setPosition(this.position)

        switch(state){
            case AnimationState.IDLE: this.idleAnimation.container.visible = true; break;
            case AnimationState.RUN: this.runAnimation.container.visible = true; break;
            case AnimationState.WALL: this.wallslideAnimation.container.visible = true; break;
            case AnimationState.CLIMB: { 
                
                // if(!this.climbStateData.right){
                //     this.climbAnimation.originOffset.x = 63
                // } else {
                //     this.climbAnimation.originOffset.x = 50;
                // }
                //this.climbAnimation.xFlip(this.climbStateData.right ? 1 : -1)
                this.climbAnimation.container.visible = true; break; 
            }

            default: AssertUnreachable(state);
        }
        
    }

    
    
}





