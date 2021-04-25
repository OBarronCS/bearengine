import { AnimatedSprite, Container, Graphics, Sprite, Texture } from "pixi.js";

import { Vec2, rotatePoint, angleBetween, Coordinate } from "shared/shapes/vec2";
import { random_range } from "shared/randomhelpers";
import { dimensions } from "shared/shapes/rectangle";
import { drawLineBetweenPoints, drawPoint } from "shared/shapes/shapedrawing";
import { clamp, PI, RAD_TO_DEG, sign } from "shared/mathutils";
import { ColliderPart, TagPart } from "shared/core/abstractpart";

import { SpritePart } from "../core-engine/parts";
import { AddOnType, TerrainHitAddon } from "../core-engine/weapons/addon";
import { BaseBulletGun } from "../core-engine/weapons/weapon";
import { DrawableEntity, Entity, SpriteEntity } from "../core-engine/entity";
import { Line } from "shared/shapes/line";
import { AssertUnreachable } from "shared/assertstatements";
import { SavePlayerAnimation } from "./testlevelentities";
import { TickTimer } from "shared/ticktimer";


enum PlayerStates {
    GROUND,
    AIR
}

interface PartData {
    textures: Texture;
    x: number,
    y: number
}

class PlayerAnimationState {
    
    public container: Container = new Container();
    public length: number;

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

    constructor(public data: SavePlayerAnimation){
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
    }

    setScale(value: number){
        this.container.scale.x = value;
        this.container.scale.y = value;
    }

    setPosition(pos: Coordinate){
        this.container.position.set(pos.x, pos.y);
    }

    setFrame(rawFrame: number){
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
    
    private runAnimation: PlayerAnimationState    

    private speed = 4;    // Frames per animation tick
    private tick = new TickTimer(this.speed, true);


    // used when in air
    yspd = 0;
    xspd = 0;
    
    // used while on ground
    gspd = 0;

    acc = 0.9;
    dec = 1.6;
    frc = 0.9
    top = 6;
    
    jump_power = -14.5;
    
    slope_normal = new Vec2(0, -1);


    downRayTop: Vec2
    downRayBot: Vec2
        
    feetRayDY = 16;
        
    // A in body, B away
    headRay: Line;
    
    wallSensorLength = 10;
    rightWallRay: Line;
    leftWallRay: Line;
    
    
    last_ground_xspd = 0;
    last_ground_yspd = 0;
    
    
    player_height: number;
    player_width: number;

    state = PlayerStates.AIR;
    last_state = PlayerStates.GROUND;
    
    
    // If both these values are >= 0, and the player is on the ground, the player will ju,mp
    // Used for coyote time
    private time_to_jump = -1;
    // Allows to press space just before hitting ground and will jump. 
    private space_time_to_jump = -1;

    // deals with edge cases of jumping, forces player to hit space button to jump again
    private forceSpacePress = false;

    private readonly MAX_SPACE_TIME_TO_JUMP = 3;

    
    private spritePart: SpritePart;
    private colliderPart: ColliderPart;
    private tag = this.addPart(new TagPart("Player"))

    private gun: BaseBulletGun;


    constructor(){
        super();

        const animationData = this.engine.getResource("player/run.json");
        const data: SavePlayerAnimation = animationData.data;
        this.runAnimation = new PlayerAnimationState(data);

        this.position.set({x : 500, y: 100});
        this.keyboard.bind("r", ()=> {
            this.position.set({x : 600, y: 100});
        });

        this.spritePart = new SpritePart("vector.jpg");
        this.spritePart.originPercent = {x:.5 ,y:.5};
        this.addPart(this.spritePart);
        
        this.colliderPart = new ColliderPart(dimensions(32,32),{x:16, y:16});
        this.addPart(this.colliderPart);

        // sprite not initialized yet
        // Maybe make textures globally accessible, since they don't actually depend on the renderer
        this.player_width = 32//this.spritePart.width;
        this.player_height = 32//this.spritePart.height;
        
        
        const {width, height} = {width:this.player_width, height:this.player_height}//this.spritePart.sprite
        const {x, y} = this.position;

        this.downRayTop = new Vec2(x,y);
        this.downRayBot = new Vec2(x,y + height / 2);

        this.headRay = new Line(new Vec2(x,y), new Vec2(x,y - height / 2))
        
        
        // LEFT AND RIGHT sensors
        // Not in use right now
        this.rightWallRay = new Line(new Vec2(x, y), new Vec2(3 + x + width / 2,y));
        this.leftWallRay = new Line(new Vec2(x, y), new Vec2(-3 + x - width / 2, y));

        this.gun = new BaseBulletGun([
            new TerrainHitAddon(),
            {
                addontype: AddOnType.SPECIAL,
                modifyShot(shotInfo, effect){
                    effect.onInterval(2, function(times){
                        this.velocity.drotate(random_range(-6,6))
                    })
                }
            },
            {
                addontype: AddOnType.SPECIAL,
                gravity: new Vec2(0,.35),
                modifyShot(shotInfo, effect){

                    const self = this;

                    effect.onUpdate(function(){
                        this.velocity.add(self.gravity);
                    })
                }
            },
        ]);
    }

    onAdd(){
        this.scene.addEntity(this.gun)
        this.runAnimation.setScale(2);
        this.engine.renderer.addSprite(this.runAnimation.container);
    }

    onDestroy(){
        this.scene.destroyEntity(this.gun)
        this.engine.renderer.removeSprite(this.runAnimation.container);
    }
    
    private setSensorLocations(){
        // Down ray
        this.downRayTop.set({ x: this.position.x, y: this.position.y - this.player_height / 4});
        rotatePoint(this.downRayTop,this.position,this.slope_normal)
        
        this.downRayBot.set({ x: this.position.x, y: this.feetRayDY + this.position.y + this.player_height / 2});
        rotatePoint(this.downRayBot,this.position,this.slope_normal)

        //head ray

        this.headRay.A.set(this.position)
        this.headRay.B.set({x: this.x,y:this.y - this.player_height / 2});
        rotatePoint(this.headRay.B,this.position,this.slope_normal);

        // LEFT AND RIGHT sensors
        this.rightWallRay.A.set(this.position)
        this.rightWallRay.B.set({x: 3 + this.x + this.wallSensorLength,y:this.y});
        rotatePoint(this.rightWallRay.B,this.position,this.slope_normal);

        this.leftWallRay.A.set(this.position);
        this.leftWallRay.B.set({x:-3 + this.x - this.wallSensorLength, y:this.y});
        rotatePoint(this.leftWallRay.B,this.position,this.slope_normal);
    }


    update(dt: number): void {
        // Weapon logic
        this.gun.position.set({x: this.x, y: this.y - 20});
        rotatePoint(this.gun.position,this.position,this.slope_normal);

        this.gun.dir.set(new Vec2(0,0).set(this.mouse.position).sub(this.gun.position));

        const angleToMouse = angleBetween(this.gun.position, this.mouse.position)
        const difference = Vec2.subtract(this.mouse.position, this.gun.position);
        if(difference.x > 0){
            this.gun.image.sprite.scale.x = 1;
            this.gun.image.angle = angleToMouse;
        } else {
            this.gun.image.sprite.scale.x = -1;
            this.gun.image.angle = angleToMouse + PI;
        }
        this.gun.operate(this.mouse.isDown("left"));

        // Adjust drawing angle 
        const angle = Math.atan2(this.slope_normal.y, this.slope_normal.x) * RAD_TO_DEG;
        this.spritePart.dangle = angle + 90;

        // Jump logic
        if(this.state == PlayerStates.GROUND){
            this.time_to_jump = 6;
        }

        const hitSpace = this.keyboard.isDown("KeyW");

        const releaseSpace = this.keyboard.wasPressed("KeyW");
        if(releaseSpace) this.forceSpacePress = false;


        if(this.state === PlayerStates.GROUND && hitSpace){
            this.space_time_to_jump = this.MAX_SPACE_TIME_TO_JUMP;
        } else {
            if(this.yspd >= 0 && hitSpace) this.space_time_to_jump = this.MAX_SPACE_TIME_TO_JUMP;
        }

        switch(this.state){
            case PlayerStates.AIR: this.Air_State(); break;
            case PlayerStates.GROUND: this.Ground_State(); break;
            default: AssertUnreachable(this.state)
        }

        // JUMP
        if(!this.forceSpacePress && this.time_to_jump >= 0 && this.space_time_to_jump >= 0){
            this.space_time_to_jump = -1;
            this.time_to_jump = -1;
            
            //yspd = jump_power;
            this.xspd = this.last_ground_xspd - this.jump_power * this.slope_normal.x;
            this.yspd = this.last_ground_yspd - this.jump_power * this.slope_normal.y;
                
            this.gspd = 0;
            this.state = PlayerStates.AIR;
            this.slope_normal.set({ x: 0, y: -1});
        }

        this.time_to_jump -= 1;
        this.space_time_to_jump -= 1;

        
        this.runAnimation.setPosition(this.position);
        if(this.tick.tick()){
            this.runAnimation.setFrame(this.tick.timesRepeated);
        }

        this.redraw();
    }

    /** If not collision to terrain, return bottom of bot ray, not rotated */
    private getFeetCollisionPoint():{ point: Vec2, normal: Vec2, collision: boolean} {
        const rightRay = this.engine.terrain.lineCollision(this.downRayTop, this.downRayBot);
        
        if(rightRay != null){
            return {
                collision: true,
                ...rightRay
            }
        } else {
            return {
                point : new Vec2(this.position.x, this.position.y + this.player_height / 2),
                normal : new Vec2(0,-1),
                collision : false
            }
        }
    }

    private Ground_State(){	
        const horz_move = +this.keyboard.isDown("KeyD") - +this.keyboard.isDown("KeyA");
        
        if (horz_move === -1) {
            if (this.gspd > 0) {
                this.gspd -= this.dec;
            } else if (this.gspd > -this.top) {
                this.gspd -= this.acc;
                if (this.gspd <= -this.top)
                    this.gspd = -this.top;
            }
        } else if (horz_move === 1) {
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
        
        // this.gspd -= -.125*this.slope_normal.x;
        this.xspd = this.gspd*-this.slope_normal.y;
        this.yspd = this.gspd*this.slope_normal.x;

        this.last_ground_xspd = this.xspd;
        this.last_ground_yspd = this.yspd;

        // Wall check
        const gdir = sign(this.gspd);

        //If going right. The product tests the difference in normals, makes sure doesn't go into too steep terrain
        if(gdir > 0){
            const wall_test = this.engine.terrain.lineCollision(this.rightWallRay.A, this.rightWallRay.B);
            
            if(wall_test === null || Vec2.dot(wall_test.normal, this.slope_normal) > .3){
                this.position.x += this.xspd;
                this.position.y += this.yspd;
            }
        } else if(gdir < 0) {
            const wall_test = this.engine.terrain.lineCollision(this.leftWallRay.A, this.leftWallRay.B);
            
            if(wall_test === null || Vec2.dot(wall_test.normal, this.slope_normal) > .3){
                this.position.x += this.xspd;
                this.position.y += this.yspd;
            }
        }
        
        this.setSensorLocations();

        const downray = this.getFeetCollisionPoint();
        
        this.slope_normal.set(downray.normal);
    
        // Clamps player to ground
        this.position.x = downray.point.x +  this.slope_normal.x * (this.player_height / 2);
        this.position.y  = downray.point.y +  this.slope_normal.y * (this.player_height / 2);
        
        // If nothing below me suddenly
        if(!downray.collision){
            this.state = PlayerStates.AIR
        }
    }
     
    private Air_State(){
        // gravity
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
        // Only in this wall type would I change the direction of the RAY cast and 
        // If going too fast, slowdown to top speed
        if(Math.abs(this.xspd) > this.top){
            this.xspd -= Math.min(Math.abs(this.xspd), this.frc/7) * Math.sign(this.xspd);
        }
        
        // Don't add gravity if we are on the ground
        if(Math.sign(this.yspd) >= 0){
            this.yspd += .7 * grav
        } else {
            this.yspd += .65 * grav;
        }
        
        this.yspd = clamp(this.yspd, -100, 20)
        
        const ydir = sign(this.yspd);

        // if going up
        if(ydir < 0){
            this.headRay.B.y += this.yspd;
            const head_test = this.engine.terrain.lineCollision(this.headRay.A, this.headRay.B);

            if(head_test === null){
                this.position.y += this.yspd;
            } else {
                // Hit head!
                this.yspd = 0;
                this.position.y = head_test.point.y + this.player_height / 2;
                this.space_time_to_jump = -1;
                this.time_to_jump = -1;
                this.forceSpacePress = true
            }
        } else {
            this.position.y += this.yspd;
        }

        this.setSensorLocations();
        
        // Check wall collisions
        const xdir = sign(this.xspd);

        if(xdir > 0){
            // Look enough to the right so it doesn't phase through wall
            this.rightWallRay.B.x += this.xspd;
            const wall_test = this.engine.terrain.lineCollision(this.rightWallRay.A, this.rightWallRay.B);
            
            if(wall_test === null){
                this.position.x += this.xspd;
            } else {
                this.x = wall_test.point.x - this.wallSensorLength;
            }
        } else if(xdir < 0) {
            this.rightWallRay.B.x += this.xspd;
            const wall_test = this.engine.terrain.lineCollision(this.leftWallRay.A, this.leftWallRay.B);
            
            if(wall_test === null){
                this.position.x += this.xspd;
            } else {
                this.x = wall_test.point.x + this.wallSensorLength;
            }
        }


        this.setSensorLocations();
        

        // If going down, check to see if hit ground
        if(this.yspd > 0){
            const ray = this.getFeetCollisionPoint();
        
            this.slope_normal.set(ray.normal);
    
            this.position.x = ray.point.x + this.slope_normal.x * (this.player_height / 2);
            this.position.y = ray.point.y + this.slope_normal.y * (this.player_height / 2);

            if(ray.collision){
                this.state = PlayerStates.GROUND
                // Set GSPD here
                this.gspd += this.yspd * this.slope_normal.x
                this.gspd += this.xspd * -this.slope_normal.y
                
                this.yspd = 0;
                this.xspd = 0;
            }
        }
    }

    draw(g: Graphics) {
        drawPoint(g,this.position);
        this.headRay.draw(g, 0xFF00FF)
        this.rightWallRay.draw(g, 0x00FF00);
        this.leftWallRay.draw(g);
        drawLineBetweenPoints(g, this.downRayBot, this.downRayTop,0x0000FF)
        
    }
}

