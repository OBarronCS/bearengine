import { RAD_TO_DEG, Graphics } from "pixi.js";
import { Vec2, rotatePoint } from "shared/shapes/vec2";
import { random_range, random } from "shared/randomhelpers";
import { dimensions } from "shared/shapes/rectangle";
import { drawPoint } from "shared/shapes/shapedrawing";
import { ColliderPart } from "shared/core/sharedparts"
import { clamp } from "shared/miscmath";


import { DefaultBulletEffect } from "../core-engine/clienteffects";
import { SpritePart } from "../core-engine/parts";
import { AddOnType } from "../core-engine/weapons/addon";
import { DefaultGun } from "../core-engine/weapons/weapon";

import { DrawableEntity, Entity } from "../core-engine/entity";


enum PlayerStates {
    Ground,
    Air
}


export type PlayerActions = "left" | "right" | "jump";

export class Player extends DrawableEntity {
    yspd = 0;
    xspd = 0;
    
    gspd = 0;
    acc = 0.9;
    dec = 1.6;
    frc = 0.9
    top = 6;
    
    jump_power = -14.5;
    
    slope_normal = new Vec2(0, -1);

    downRayTop: Vec2
    downRayBot: Vec2
            
            
    // LEFT AND R
    leftRayRight: Vec2;
    leftRayLeft: Vec2;
            
    rightRayRight: Vec2;
    rightRayLeft: Vec2;
    
    feetRayDY = 16;
    
    test_height: number;
    test_width: number;

    state = PlayerStates.Air;
    last_state = PlayerStates.Ground;
    
    
    time_to_jump = -1;
    space_time_to_jump = -1;

    private spritePart: SpritePart;
    private colliderPart: ColliderPart;

    constructor(){
        super();
        this.position.set({x : 500, y: 100})

        this.spritePart = new SpritePart("images/flower.png")
        this.spritePart.originPercent = {x:.5 ,y:.5};
        this.addPart(this.spritePart);
        
        this.colliderPart = new ColliderPart(dimensions(50,50),{x:20, y: 20});
        this.addPart(this.colliderPart);


        this.test_width = this.spritePart.width;
        this.test_height = this.spritePart.height;
        
        
        const {width, height} = this.spritePart.sprite
        const {x, y} = this.position

        this.downRayTop = new Vec2(x,y);
        this.downRayBot = new Vec2(x,y + height / 2);
        
        
        // LEFT AND RIGHT sensors
        this.leftRayRight = new Vec2(x, y);
        this.leftRayLeft = new Vec2(-3 + x - width / 2, y);
        
        this.rightRayRight = new Vec2(x, y);
        this.rightRayLeft = new Vec2(3 + x + width / 2,y);


        this.gun = new DefaultGun();
        this.gun.addons.push({
            addontype: AddOnType.SPECIAL,
            modifyShot : function(shotInfo, effect){
                effect.onInterval(2, function(this: DefaultBulletEffect, times){
                    this.velocity.drotate(random_range(-22,22))
                })
                effect.onInterval(4, function(this: DefaultBulletEffect,lap){
                    this.velocity.extend(10 + random(10));
                })
                
                effect.destroyAfter(10000);
            }
        })

        // E.Engine.effectHandler.addEffect(
        //     new VecTween(this, "position", 5).from({x: 0, y:0 }).to({x: 50, y: 700}).go()
        // ).chain(new VecTween(this, "position", 2).from({x: 50, y: 700}).to({x: 500, y: 0}))
    }

    private gun: DefaultGun;
    
    // setSensorLocations(){
    //     const dy = 0; 
    
    //     // LEFT AND RIGHT sensors
    //     leftRayRight.set(x, y);
    //     leftRayLeft.set(-3 + x - width / 2, y);
    
    //     rightRayRight.set(x, y);
    //     rightRayLeft.set(3 + x + width / 2,y);
    // }

    update(dt: number): void {
        this.redraw()
        this.gun.setLocation(this.position, (new Vec2(0,0).set(this.Mouse.position).sub(this.position)));
        this.gun.operate(this.Mouse.isDown("left"));

        const start_x = this.position.x;
        const angle = Math.atan2(this.slope_normal.y, this.slope_normal.x) * RAD_TO_DEG;
        this.spritePart.dangle = angle + 90;

        if(this.state == PlayerStates.Ground){
            this.time_to_jump = 6;
        }

        if(this.Keyboard.isDown("KeyW")){
            this.space_time_to_jump = 5;
        }

        if(this.state == PlayerStates.Ground){
            
            this.Ground_State();
            
        } else if(this.state == PlayerStates.Air){
            this.Air_State();
        }


        if( this.time_to_jump >= 0 &&  this.space_time_to_jump >= 0){
            this.space_time_to_jump = -1;
            this.time_to_jump = -1;
            
            //yspd = jump_power;
            this.xspd -=  this.jump_power* this.slope_normal.x;
            this.yspd -=  this.jump_power* this.slope_normal.y;
                
            this.gspd = 0;
            this.state = PlayerStates.Air;
            this.slope_normal.set({ x: 0, y: -1});
        }

        this.time_to_jump -= 1;
        this.space_time_to_jump -= 1;



        // // WALL COLLISIONS
        // var xdir = sign(xspd);
        // var ydir = sign(yspd);
        // setSensorLocations();


        // if(xdir == -1){
        //     var wall_test = Terrain.lineCollision(leftRayRight, leftRayLeft);
                
        //     if(wall_test != -1){
        //         x = wall_test.point.x + (3 + sprite_width / 2)
        //     }		
        // } else {
        //     var wall_test = Terrain.lineCollision(rightRayLeft, rightRayRight);
                
        //     if(wall_test != -1){
        //         x = wall_test.point.x - (3 + sprite_width / 2)
        //     }
        // }
    }

    getFeetCollisionPoint():{
        point: Vec2
        normal: Vec2
        collision: boolean
    } {
        const height =  this.test_height;
        const width = this.test_width;
        // Down sensors
        
        this.downRayTop.set(this.position);
        rotatePoint(this.downRayTop,this.position,this.slope_normal)
        
        this.downRayBot.set({ x: this.position.x, y : this.feetRayDY + this.position.y + this.test_height / 2});
        rotatePoint(this.downRayBot,this.position,this.slope_normal)
        
        const rightRay = this.Terrain.lineCollision(this.downRayTop, this.downRayBot);
        
        if(rightRay != null){
            // @ts-expect-error
            rightRay.collision = true;
            // @ts-expect-error
            return rightRay;
        } else {
            const answer_struct = {
                point : new Vec2(this.position.x, this.position.y + height / 2),
                normal : new Vec2(0,-1),
                collision : false
            }
            
            return answer_struct;
        }
    }


    Ground_State(){	
        const horz_move = +this.Keyboard.isDown("KeyD") - +this.Keyboard.isDown("KeyA");
        
        if (horz_move == -1) {
            if (this.gspd > 0) {
                this.gspd -= this.dec;
            } else if (this.gspd > -this.top) {
                this.gspd -= this.acc;
                if (this.gspd <= -this.top)
                    this.gspd = -this.top;
            }
        } else if (horz_move == 1) {
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
        
        //gspd -= -.125*slope_normal.x;
        this.xspd = this.gspd*-this.slope_normal.y;
        this.yspd = this.gspd*this.slope_normal.x;

        this.position.x += this.xspd;
        this.position.y += this.yspd;
        
        const ray = this.getFeetCollisionPoint();
        
        this.slope_normal.set(ray.normal);
    
        this.position.x = ray.point.x +  this.slope_normal.x * ( this.test_height / 2);
        this.position.y  = ray.point.y +  this.slope_normal.y * ( this.test_height / 2);
        
        // If nothing below me suddenly
        if(!ray.collision){
            this.state = PlayerStates.Air
        }
    }
    
    
    
    Air_State(){
        // gravity
        const grav = 1.2;
        const horz_move = +this.Keyboard.isDown("KeyD") - +this.Keyboard.isDown("KeyA");   

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
        
        this.position.x += this.xspd;
        this.position.y += this.yspd;

        // If going down
        if(this.yspd > 0){
            const ray = this.getFeetCollisionPoint();
        
            this.slope_normal.set(ray.normal);
    
            this.position.x = ray.point.x + this.slope_normal.x * (this.test_height / 2);
            this.position.y = ray.point.y + this.slope_normal.y * (this.test_height / 2);
            
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
        g.clear();
        drawPoint(g,this.position);
    }
}

