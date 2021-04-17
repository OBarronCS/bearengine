import type { Graphics } from "pixi.js";

import { Vec2, rotatePoint, angleBetween } from "shared/shapes/vec2";
import { random_range } from "shared/randomhelpers";
import { dimensions } from "shared/shapes/rectangle";
import { drawLineBetweenPoints, drawPoint } from "shared/shapes/shapedrawing";
import { clamp, PI, RAD_TO_DEG, sign } from "shared/mathutils";
import { ColliderPart, TagPart } from "shared/core/abstractpart";

import { SpritePart } from "../core-engine/parts";
import { AddOnType, TerrainHitAddon } from "../core-engine/weapons/addon";
import { BaseBulletGun } from "../core-engine/weapons/weapon";
import { DrawableEntity } from "../core-engine/entity";
import { Line } from "shared/shapes/line";
import { AssertUnreachable } from "shared/assertstatements";


enum PlayerStates {
    Ground,
    Air
}

export type PlayerActions = "left" | "right" | "jump";

export class Player extends DrawableEntity {
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

    state = PlayerStates.Air;
    last_state = PlayerStates.Ground;
    
    
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
        this.scene.addEntity(this.gun);
    }

    onDestroy(){
        this.scene.destroyEntity(this.gun);
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
        if(this.state == PlayerStates.Ground){
            this.time_to_jump = 6;
        }

        const hitSpace = this.keyboard.isDown("KeyW");

        const releaseSpace = this.keyboard.wasPressed("KeyW");
        if(releaseSpace) this.forceSpacePress = false;


        if(this.state === PlayerStates.Ground && hitSpace){
            this.space_time_to_jump = this.MAX_SPACE_TIME_TO_JUMP;
        } else {
            if(this.yspd >= 0 && hitSpace) this.space_time_to_jump = this.MAX_SPACE_TIME_TO_JUMP;
        }

        switch(this.state){
            case PlayerStates.Air: this.Air_State(); break;
            case PlayerStates.Ground: this.Ground_State(); break;
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
            this.state = PlayerStates.Air;
            this.slope_normal.set({ x: 0, y: -1});
        }

        this.time_to_jump -= 1;
        this.space_time_to_jump -= 1;

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
            this.state = PlayerStates.Air
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
                this.state = PlayerStates.Ground
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

