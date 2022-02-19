import { AnimatedSprite, Container, filters, Graphics, Sprite, Texture } from "shared/graphics/graphics";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { ColliderPart } from "shared/core/entitycollision";
import { clamp, floor, lerp, min, PI, RAD_TO_DEG, sign } from "shared/misc/mathutils";
import { Line } from "shared/shapes/line";
import { dimensions } from "shared/shapes/rectangle";
import { drawCircle, drawCircleOutline, drawProgressBar, drawPoint } from "shared/shapes/shapedrawing";
import { angleBetween, Coordinate, mix, rotatePoint, Vec2 } from "shared/shapes/vec2";
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
import { easeInOutExpo, NumberTween, VecTween } from "shared/core/tween";
import { BoostDirection } from "./boostzone";
import { InterpolatedVar } from "../core-engine/networking/cliententitydecorators";
import { SlowAttribute } from "shared/core/sharedlogic/sharedattributes";
import { ProgressBarWidget, uisize } from "../ui/widget";
import { CreateInputConverter, inputv } from "../input/inputcontroller";
import { SimpleBouncePhysics } from "shared/core/sharedlogic/sharedphysics";
import { Color } from "shared/datastructures/color";
import { BearEngine, NetworkPlatformGame } from "../core-engine/bearengine";
import { choose } from "shared/datastructures/arrayutils";



export enum PlayerState {
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


enum AnimationControlState {
    NORMAL,
    PHYSICS,
    INTERP_BODY_PARTS
}


class BodyPartPhysicsData {
    readonly slow_factor = 0.7;

    position = new Vec2(0,0);
    velocity = new Vec2(0,0);
    gravity = new Vec2(0,.4);
    alpha = 1;

    
    stopped = false;
    start_reshape_position = new Vec2();

    constructor(public target_sprite: AnimatedSprite, public start_sprite_offset: Vec2){}

    private drawRadius = 10;
}



class PlayerAnimationState {

    public readonly ticks_per_frame: number
    
    ticks_in_current_state = 0;
    mode: AnimationControlState = AnimationControlState.NORMAL;
    physics_state_data: { max_ticks: number, current_tick: number, data: BodyPartPhysicsData[] } = { data: [], max_ticks: 0, current_tick: 0 };

    reshape_state_data: { length_in_ticks: number, current_tick: number} = { current_tick: 0, length_in_ticks: 0 };

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


    private scale_sprites(scale: number){
        const a = [ this.headTextures,
                    this.bodyTexture,
                    this.leftHandTextures,
                    this.rightHandTextures,
                    this.leftFootTextures,
                    this.rightFootTextures,
        ];

        for(const part of a){
            for(const p of part){
                p.x *= scale;
                p.y *= scale;
            }
        }
    }

    setScale(value: number){
        this.originOffset.scale(value);
        this.scale_sprites(value);
        this.headSprite.scale.set(value);
        this.bodySprite.scale.set(value);
        this.leftHandSprite.scale.set(value);
        this.rightHandSprite.scale.set(value);
        this.leftFootSprite.scale.set(value);
        this.rightFootSprite.scale.set(value);

        this.setFrame(this.timer.timesRepeated);
    }

    constructor(public data: SavePlayerAnimation, ticks_per_frame: number, public originOffset = new Vec2(0,0),
        public game: NetworkPlatformGame
    ){
        this.ticks_per_frame = ticks_per_frame;

        this.timer = new TickTimer(this.ticks_per_frame, true);

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

        this.container.addChild(this.headSprite);
        this.container.addChild(this.headSprite);
        this.container.addChild(this.bodySprite);
        this.container.addChild(this.leftHandSprite);
        this.container.addChild(this.rightHandSprite);
        this.container.addChild(this.leftFootSprite);
        this.container.addChild(this.rightFootSprite);

        this.container.pivot.set(this.originOffset.x,this.originOffset.y);

        this.setFrame(0);
    }

    tick(){
        this.ticks_in_current_state++;
        const tick = this.timer.tick();
        if(this.mode == AnimationControlState.NORMAL){
            if(tick){
                this.setFrame(this.timer.timesRepeated);
            } 
        } else if (this.mode == AnimationControlState.PHYSICS){
            this.tick_physics();
        } else if (this.mode == AnimationControlState.INTERP_BODY_PARTS){
            this.tick_reshape();
        }
    }

    start_normal(){
        this.ticks_in_current_state = 0;
        this.mode = AnimationControlState.NORMAL;
    }

    physics_ticker = new TickTimer(1);
    tick_physics(){
        if(!this.physics_ticker.tick()) return;
        this.physics_state_data.current_tick++;

        if(this.physics_state_data.current_tick < this.physics_state_data.max_ticks){
            for(const part of this.physics_state_data.data){
                if(!part.stopped){
                    const status = SimpleBouncePhysics(this.game.terrain, part.position, part.velocity, part.gravity, part.slow_factor)
                    part.stopped = status.stopped;
                    
                    const target_sprite_pos = Vec2.add(this.originOffset, Vec2.subtract(part.position, this.container.position));
                    part.target_sprite.position.copyFrom(target_sprite_pos);


                    const zones = this.game.collisionManager.point_query_list(part.position, BoostDirection);
                    for(const z of zones){
                        part.velocity.add(z.attr.dir);
                    }
                }
            }
        }
    }

    // Acts on idle_animation
    start_physics(){
        this.ticks_in_current_state = 0;
        // Clear it before hand
        this.physics_state_data.data = [];

        this.mode = AnimationControlState.PHYSICS;

        const {
            headSprite,
            bodySprite,
            leftHandSprite,
            rightHandSprite, 
            leftFootSprite,
            rightFootSprite
        } = this;

        const iter = [
            headSprite,
            bodySprite,
            leftHandSprite,
            rightHandSprite,
            leftFootSprite,
            rightFootSprite
        ];

        
        for(const body_part of iter){
            const start_position = Vec2.subtract(Vec2.add(this.container.position, body_part.position),this.originOffset);
            
            const physics_data = new BodyPartPhysicsData(body_part, Vec2.from(body_part.position));
            physics_data.position.set(start_position);

            physics_data.velocity.set(new Vec2(random_range(-20, 20), random_range(-20, 20)));

            this.physics_state_data.data.push(physics_data);
            this.physics_state_data.current_tick = 0;
            this.physics_state_data.max_ticks = 600;
        }
    }
    
    reshape_test = new TickTimer(1)
    tick_reshape(){
        if(!this.reshape_test.tick()) return;
        this.reshape_state_data.current_tick++;

        if(this.reshape_state_data.current_tick <= this.reshape_state_data.length_in_ticks){
            const t = this.reshape_state_data.current_tick / this.reshape_state_data.length_in_ticks;

            for(const part of this.physics_state_data.data){
                const start_pos = part.start_reshape_position; //part.position.clone();

                const end_pos = Vec2.subtract(Vec2.add(this.container.position, part.start_sprite_offset),this.originOffset);
                
                const aug_t = easeInOutExpo(t);

                mix(start_pos, end_pos, aug_t, part.position);

                const target_sprite_pos = Vec2.add(this.originOffset, Vec2.subtract(part.position, this.container.position));
                part.target_sprite.position.copyFrom(target_sprite_pos);
            }
        } else {
            this.start_normal();
        }
    }

    start_body_reshaping(){
        // Assumes we are currently in the physics state
        this.ticks_in_current_state = 0;
        this.mode = AnimationControlState.INTERP_BODY_PARTS;
        this.reshape_state_data = {
            current_tick: 0,
            length_in_ticks: 90
        }
        
        for(const part of this.physics_state_data.data){
            part.start_reshape_position.set(part.position);
        }
    }

    /** Does not work at all */
    set_color(color: Color){
        const hex = color.hex();
        this.headSprite.tint = hex;
        this.headSprite.tint = hex;
        this.bodySprite.tint = hex;
        this.leftHandSprite.tint = hex;
        this.rightHandSprite.tint = hex;
        this.leftFootSprite.tint = hex;
        this.rightFootSprite.tint = hex;
    }

    xFlip(value: number){
        if(value < 0){
            this.container.scale.x = -1;
        } else if(value > 0){
            this.container.scale.x = 1
        }
    }


    move(dx: number,dy: number){
        this.container.position.x += dx;
        this.container.position.y += dy;
    }

    setPosition(pos: Coordinate){
        this.container.position.set(pos.x, pos.y);
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

export const player_controls_map = CreateInputConverter(
    {
        jump: inputv.key("KeyW"),
        move_left:inputv.key("KeyA"),
        move_right:inputv.key("KeyD"),
        shoot:inputv.mouse("left"),
    }
);




export class Player extends DrawableEntity {

    private healthbar_widget = new ProgressBarWidget(new Vec2(),500,40);
    
    private readonly runAnimation = new PlayerAnimationState(this.engine.getResource("player/run.json").data as SavePlayerAnimation, 4, new Vec2(40,16), this.game);
    private readonly wallslideAnimation = new PlayerAnimationState(this.engine.getResource("player/wallslide.json").data as SavePlayerAnimation, 30, new Vec2(44,16), this.game);
    private readonly idleAnimation = new PlayerAnimationState(this.engine.getResource("player/idle.json").data as SavePlayerAnimation, 30, new Vec2(44,16), this.game);
    private readonly climbAnimation = new PlayerAnimationState(this.engine.getResource("player/climb.json").data as SavePlayerAnimation, 7, new Vec2(50,17), this.game);


    last_ground_velocity = new Vec2(0,0)
    velocity = new Vec2(0,0);
    gspd = 0;

    private readonly gravity = new Vec2(0, 1.2);
    // private readonly gravity_normalized = this.gravity.clone().normalize();

    private readonly acc = 0.9;
    private readonly dec = 1.6;
    private readonly frc = 0.9

    private readonly top = 7; //6
    private readonly jump_power = -15; //-14

    private ghost = false;
    health = 100;

    slow_factor = 1;

    // Item graphics
    private itemInHand: ItemDrawer = new ItemDrawer();
    
    private usable_item: UsableItem<any> = null;

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

    

    // Normal of the slope I'm making contact with. Is (0,-1) if in air
    slope_normal = new Vec2(0, -1);

    player_height: number = 48;
    player_width: number = 30;


    // For all of these: A in body, B is away from body
    leftHeadRay: Line;
    rightHeadRay: Line;

    private readonly downRayAdditionalLength = 6;
    leftDownRay: Line;
    midDownRay: Line;
    rightDownRay: Line;

    

    private readonly wallSensorLength = 16 + 5;
    rightWallRay: Line;
    leftWallRay: Line;

    private readonly slideSensorLength = this.wallSensorLength + 16;

    private readonly climbSensorLength = this.wallSensorLength + 5;
    
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

        this.game.ui.addWidget(this.healthbar_widget.setPosition(uisize.percent(.5), uisize.pixels(30)).center());



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

        // this.runAnimation.set_color(Color.random())
        // this.wallslideAnimation.set_color(Color.random())
        // this.idleAnimation.set_color(Color.random())
        // this.climbAnimation.set_color(Color.random());
    }

    override onDestroy(){
        this.game.ui.removeWidget(this.healthbar_widget);

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
    
    force_position(pos: Coordinate){
        this.state = PlayerState.AIR;
        this.position.set(pos);
    }

    private setSensorLocationsAndRotate(){
        this.setSensorLocations();

        const unit_vector = this.gravity.clone().negate().normalize();

        // Ground sensors
        rotatePoint(this.leftDownRay.A,this.position,unit_vector);
        rotatePoint(this.leftDownRay.B,this.position,unit_vector);

        rotatePoint(this.rightDownRay.A,this.position,unit_vector);
        rotatePoint(this.rightDownRay.B,this.position,unit_vector);

        rotatePoint(this.midDownRay.A,this.position,unit_vector);
        rotatePoint(this.midDownRay.B,this.position,unit_vector);

        // Head rays
        rotatePoint(this.leftHeadRay.A,this.position,unit_vector);
        rotatePoint(this.leftHeadRay.B,this.position,unit_vector);

        rotatePoint(this.rightHeadRay.A,this.position,unit_vector);
        rotatePoint(this.rightHeadRay.B,this.position,unit_vector);

        // LEFT AND RIGHT sensors
        //rotatePoint(this.rightWallRay.A,this.position,unit_vector);
        rotatePoint(this.rightWallRay.B,this.position,unit_vector);

        //rotatePoint(this.leftWallRay.A,this.position,unit_vector);
        rotatePoint(this.leftWallRay.B,this.position,unit_vector);

        rotatePoint(this.rightClimbRay.B,this.position,unit_vector);
        rotatePoint(this.rightClimbRay.B,this.position,unit_vector);

        rotatePoint(this.leftClimbRay.B,this.position,unit_vector);
        rotatePoint(this.leftClimbRay.B,this.position,unit_vector);


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

    update(dt: number): void {
    }

    manualUpdate(dt: number): void {
        this.healthbar_widget.percent = this.health / 100;

        this.engine.camera.setDangle(-this.gravity.dangle() + 90)

        if(this.keyboard.wasPressed("KeyP")){
            this.position.set(choose(this.game.activeLevel.spawn_positions));
            // Maybe GO TO A RANDOM SPAWN POSITION
        }


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
                const consumed = this.usable_item.operate(dt, this.position, this.mouse.position, this.game.player_controller.isDown("shoot"), this.game, this);
                this.usable_item.consumed = consumed;
            }
        } 


        // Adjust drawing angle 
        const angle = Math.atan2(this.slope_normal.y, this.slope_normal.x) * RAD_TO_DEG;

 
        this.slow_factor = 1;

        // const slow_zones = this.game.collisionManager.colliders_on_point(this.position, "SlowZone");
        const slow_zones = this.game.collisionManager.point_query_list(this.position, SlowAttribute);
        for(const slow of slow_zones){

            if(Vec2.distanceSquared(this.position, slow.entity.position) < slow.attr.radius**2){
                this.slow_factor = slow.attr.slow_factor;
            }
        }

        const zones = this.game.collisionManager.point_query_list(this.position, BoostDirection);

        for(const z of zones){
            // const dir = z.entity.getAttribute(BoostDirection).dir;
            this.velocity.add(z.attr.dir);
        }


        if(this.game.player_controller.wasPressed("jump")) this.timeSincePressedJumpedButton = 0;
        
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

    knockback(dir: Vec2){
        this.state = PlayerState.AIR;
        this.velocity.add(dir);
        // this.xspd += dir.x;
        // this.yspd += dir.y;
    }  

    private wallSlideNormalIsValid(normal: Vec2): boolean {
        //The dot product tests the difference in normals, makes sure doesn't go into too steep terrain
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

    private Wall_Slide_State(): void {
        this.slideStateData.timeSliding++;

        this.wallslideAnimation.setPosition(this.position);
        this.wallslideAnimation.tick();
        this.wallslideAnimation.xFlip(this.slideStateData.right ? 1 : -1);

        // Wall jump
        if(this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed){
            this.state = PlayerState.AIR;
            this.velocity.y = -14
            this.velocity.x = this.slideStateData.right ? -9 : 9;
            this.timeSincePressedJumpedButton = 10000;

            this.setAnimationSprite(AnimationState.RUN)

            return;
        }

        

        //while below timer, slow yspd to 0
        if(this.slideStateData.timeSliding < this.timeToSlide){
            this.velocity.y = lerp(this.velocity.y,0,.25);
        } else {
            this.velocity.y = lerp(this.velocity.y,3.6,.1);
        }

        this.position.y += this.velocity.y / this.slow_factor;

        let myWallNormal: Vec2;

        // Slide down wall
        this.setWallSensorsEven(this.slideSensorLength);

        const FALL_OFF_SPEED = 2.5;

        if(this.slideStateData.right){
            const rightWall = this.getRightWallCollisionPoint();
            
            if(rightWall.collision){
                if(!this.wallSlideNormalIsValid(rightWall.normal)){
                    console.log("To Steep")
                    this.state = PlayerState.AIR;
                    this.velocity.x = 0;
                    this.setAnimationSprite(AnimationState.RUN)
                    return;
                } 
                
                this.x = rightWall.point.x - this.wallSensorLength;
                myWallNormal = rightWall.normal;
            } 

            if(!rightWall.both){
                this.state = PlayerState.AIR;
                this.velocity.y = 2;
                this.velocity.x = 0;
                this.setAnimationSprite(AnimationState.RUN);
            }

            if(this.game.player_controller.isDown("move_left")){
                this.state = PlayerState.AIR;
                // this.velocity.y = -14
                this.velocity.x = -FALL_OFF_SPEED
                this.setAnimationSprite(AnimationState.RUN);
                this.ticksSinceGroundState = -3;
                // this.timeSincePressedJumpedButton = this.timeSincePressedAllowed
            }
        } else {
            const leftWall = this.getLeftWallCollisionPoint();
            
            if(leftWall.collision){
                if(!this.wallSlideNormalIsValid(leftWall.normal)){
                    console.log("To Steep")
                    this.state = PlayerState.AIR;
                    this.velocity.x = 0;
                    this.setAnimationSprite(AnimationState.RUN);
                    return;
                } 
                this.x = leftWall.point.x + this.wallSensorLength;
                myWallNormal = leftWall.normal;
            }

            if(!leftWall.both){
                this.state = PlayerState.AIR;
                this.velocity.x = 0;
                this.setAnimationSprite(AnimationState.RUN);
            }

            if(this.game.player_controller.isDown("move_right")){
                this.state = PlayerState.AIR;
                // this.velocity.y = -14
                this.velocity.x = FALL_OFF_SPEED
                this.ticksSinceGroundState = -3;
                this.setAnimationSprite(AnimationState.RUN)
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
            this.velocity.y = 0;
            this.velocity.x = 0;
        }

    }

    private Ground_State(): void {
    
        this.ticksSinceGroundState = 0;
        this.last_ground_velocity.set(this.velocity);
        // this.last_ground_xspd = this.xspd;
        // this.last_ground_yspd = this.yspd;

        // Change gspd based on input
        const horz_move = +this.game.player_controller.isDown("move_right") - +this.game.player_controller.isDown("move_left");

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

        
        this.velocity.x = this.gspd*-this.slope_normal.y;
        this.velocity.y = this.gspd*this.slope_normal.x;
        
        // this.xspd = this.gspd*-this.slope_normal.y;
        // this.yspd = this.gspd*this.slope_normal.x;

        // Before moving, check walls
        const gdir = sign(this.gspd);

        
        this.setWallSensorsEven();
        

        if(gdir > 0){
            this.rightWallRay.B.x += this.velocity.x;
            this.rightClimbRay.B.x += this.velocity.x
            const rightWall = this.getRightWallCollisionPoint();

            // If hit wall, adjust speed so don't hit wall
            if(rightWall.collision){ //  || Vec2.dot(wall_test.normal, this.slope_normal) > .3
                // this.rightWalRay.B.x is the same as climbRay. Maybe make it another variable
                const distanceInWall = this.rightWallRay.B.x - rightWall.point.x;
                this.velocity.x -= distanceInWall;
                this.gspd = 0;
            }
        } else if(gdir < 0) {
            this.leftWallRay.B.x += this.velocity.x;
            this.leftClimbRay.B.x += this.velocity.x

            const leftWall = this.getLeftWallCollisionPoint();

            if(leftWall.collision){
                const distanceInWall = leftWall.point.x - this.leftWallRay.B.x;
                this.velocity.x += distanceInWall;
                this.gspd = 0;
            }
        }

        // Move player
        this.position.add(this.velocity)
        
        // this.position.x += this.xspd / this.slow_factor;
        // this.position.y += this.yspd / this.slow_factor;

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


        // ANIMATION
        if(this.gspd === 0) this.setAnimationSprite(AnimationState.IDLE);
        else this.setAnimationSprite(AnimationState.RUN);

        this.idleAnimation.setPosition(this.position);
        this.idleAnimation.tick();
        this.idleAnimation.xFlip(horz_move);
                
        this.runAnimation.setPosition(this.position);
        this.runAnimation.tick();
        this.runAnimation.xFlip(horz_move);

        // Check for jumping
        const jumpButtonDown = this.game.player_controller.isDown("jump");
        
        // JUMP
        if(jumpButtonDown || (this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed)){
            //yspd = jump_power;
            // this.xspd = this.last_ground_xspd - this.jump_power * this.slope_normal.x;
            // this.yspd = /** this.last_ground_yspd + */ this.jump_power // * this.slope_normal.y;

            this.velocity.y = this.jump_power;
            
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

        if(this.velocity.x !== 0) this.setAnimationSprite(AnimationState.RUN)
        this.runAnimation.setPosition(this.position);
        this.runAnimation.tick();
        this.runAnimation.xFlip(this.velocity.x)
        
        // gravity
        this.ticksSinceGroundState += 1;

        // Coyote time jump
        if(this.ticksSinceGroundState <= this.COYOTE_TIME){
            if(this.timeSincePressedJumpedButton <= this.timeSincePressedAllowed){
                this.timeSincePressedJumpedButton = 10000;
                // this.xspd = this.last_ground_xspd - this.jump_power * this.slope_normal.x;
                // this.yspd = /** this.last_ground_yspd + */ this.jump_power // * this.slope_normal.y;
                this.velocity.y = this.jump_power;
            }
        }

        const horz_move = +this.game.player_controller.isDown("move_right") - +this.game.player_controller.isDown("move_left");  

        if (horz_move === -1) {
            if (this.velocity.x > 0) {
                this.velocity.x -= this.dec;
            } else if (this.velocity.x > -this.top) {
                this.velocity.x -= this.acc;
                if (this.velocity.x <= -this.top)
                    this.velocity.x = -this.top;
            }
        } else if (horz_move === 1) {
            if (this.velocity.x < 0) {
                this.velocity.x += this.dec;
            } else if (this.velocity.x < this.top) {
                this.velocity.x += this.acc;
                if (this.velocity.x >= this.top)
                    this.velocity.x = this.top;
            }
        } else {
            this.velocity.x -= Math.min(Math.abs(this.velocity.x), this.frc/7) * Math.sign(this.velocity.x);
        }
        

        // Drag
        if(Math.abs(this.velocity.x) > this.top){
            this.velocity.x -= Math.min(Math.abs(this.velocity.x), this.frc/7) * Math.sign(this.velocity.x);
        }
        
        // Gravity
        if(Math.sign(this.velocity.y) >= 0){
            // Going down
            this.velocity.add(this.gravity.clone().scale(.72)) ;
            // this.velocity.y += .72 * this.gravity.y
        } else {
            this.velocity.add(this.gravity.clone().scale(.65));
            // this.velocity.y += .65 * this.gravity.y;
        }
        
        // Clamp yspd
        this.velocity.y = clamp(this.velocity.y, -100, 20);

        
        const xdir = sign(this.velocity.x);
        const ydir = sign(this.velocity.y);

        this.setWallSensorsEven();
        // Checks wall slide BEFORE movement
        if(xdir > 0){
            this.rightWallRay.B.x += this.velocity.x;
            this.rightClimbRay.B.x += this.velocity.x
            const rightWall = this.getRightWallCollisionPoint();

            // If hit wall, adjust speed so don't hit wall
            if(rightWall.collision){ //  || Vec2.dot(wall_test.normal, this.slope_normal) > .3


                this.x = rightWall.point.x - this.wallSensorLength;
                if(rightWall.both){
                    this.velocity.x = 10;
                }
               

                if(rightWall.both && this.wallSlideNormalIsValid(rightWall.normal)){

                    if(ydir > 0){
                        this.state = PlayerState.WALL_SLIDE;
                        this.slideStateData = {
                            right: true,
                            timeSliding: 0
                        }

                        this.setAnimationSprite(AnimationState.WALL);
                        return;
                    } else {
                        const distanceInWall = this.rightWallRay.B.x - rightWall.point.x;
                        
                    }
                }

            }
        } else if(xdir < 0) {
            this.leftWallRay.B.x += this.velocity.x;
            this.leftClimbRay.B.x += this.velocity.x

            const leftWall = this.getLeftWallCollisionPoint();

            if(leftWall.collision){
                
                this.x = leftWall.point.x + this.wallSensorLength;
                if(leftWall.both){
                    this.velocity.x = -10;
                }


                if(leftWall.both && this.wallSlideNormalIsValid(leftWall.normal)){
                    if(ydir > 0){
                        this.state = PlayerState.WALL_SLIDE;
                        this.slideStateData = {
                            right: false,
                            timeSliding: 0
                        }
                        this.setAnimationSprite(AnimationState.WALL);
                        return;
                    } else {
                        const distanceInWall = leftWall.point.x - this.leftWallRay.B.x;
                       
                    }
                }
            }
        }

        // Move player
        this.position.add(this.velocity.clone().scale(1/this.slow_factor))

        // this.position.x += this.xspd / this.slow_factor;
        // this.position.y += this.yspd / this.slow_factor; 

        

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

        // Check for CLIMBING
        this.setSensorLocations();
        if(xdir > 0){
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
        } else if(xdir < 0){
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

        // Check head and feet collision
        this.setSensorLocations();
        if(ydir < 0){
            const headTest = this.getHeadCollisionPoint();

            if(headTest.collision === true){
                // Hit head!
                this.velocity.y = 0;
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
                    this.gspd = this.velocity.x * -this.slope_normal.y

                    this.velocity.y = 0;
                    this.velocity.x = 0;
                }
            }
        }

    }

    draw(g: Graphics){
        // drawCircleOutline(g, this.position, 50)
        
        drawPoint(g,this.position);

        if(!this.ghost){
            drawProgressBar(g, this.x - 20, this.y - 40, 40, 7, this.health / 100, 1);
        }

        // g.beginFill(0xFF00FF,.4)
        // g.drawRect(this.x - this.player_width / 2, this.y - this.player_height / 2, this.player_width, this.player_height)
        // g.endFill();

        if(false){
            this.rightWallRay.draw(g, 0x00FF00);
            this.leftWallRay.draw(g);
    
            this.leftDownRay.draw(g,0xFF0000);
            this.rightDownRay.draw(g, 0xFF00FF);
            this.midDownRay.draw(g, 0x0FF00F)
    
            this.leftHeadRay.draw(g, 0x00FFFF);
            this.rightHeadRay.draw(g, 0xFFFF00);
    
            this.leftClimbRay.draw(g,0x00000)
            this.rightClimbRay.draw(g, 0xFFFFFF)
        }
        
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

        // this.runAnimation.set_color(Color.random())
        // this.wallslideAnimation.set_color(Color.random())
        // this.idleAnimation.set_color(Color.random())
        // this.climbAnimation.set_color(Color.random())
    }
    
    private readonly runAnimation = new PlayerAnimationState(this.engine.getResource("player/run.json").data as SavePlayerAnimation, 4, new Vec2(40,16), this.game);
    private readonly wallslideAnimation = new PlayerAnimationState(this.engine.getResource("player/wallslide.json").data as SavePlayerAnimation, 30, new Vec2(44,16), this.game);
    private readonly idleAnimation = new PlayerAnimationState(this.engine.getResource("player/idle.json").data as SavePlayerAnimation, 30, new Vec2(44,16), this.game);
    private readonly climbAnimation = new PlayerAnimationState(this.engine.getResource("player/climb.json").data as SavePlayerAnimation, 7, new Vec2(50,17), this.game);

    update(dt: number): void {
        this.look_angle.value.set(this.look_angle.buffer.getValue(this.game.networksystem["getServerTickToSimulate"]()))

        this.draw_item.position.set({x: this.x, y: this.y});
        this.draw_item.image.angle = this.look_angle.value.angle();

        this.runAnimation.setPosition(this.position);
        this.wallslideAnimation.setPosition(this.position);
        this.idleAnimation.setPosition(this.position);
        this.climbAnimation.setPosition(this.position);

        this.runAnimation.tick();
        this.wallslideAnimation.tick();
        this.idleAnimation.tick();
        this.climbAnimation.tick();

        if(!this.ghost){
            if(this.idleAnimation.mode === AnimationControlState.NORMAL){
                this.graphics.graphics.clear();
                drawProgressBar(this.graphics.graphics, this.x - 20, this.y - 40, 40, 7, this.health / 100, min(1,this.idleAnimation.ticks_in_current_state / 45));
            }

        }
    }


    play_death_animation(){
        this.graphics.graphics.clear();
        
        this.scene.addEntity(new EmitterAttach(this,"BOOM", "particle.png"));

        this.ghost = true;

        this.runAnimation.container.visible = false;
        this.wallslideAnimation.container.visible = false;
        this.climbAnimation.container.visible = false;

        this.idleAnimation.container.visible = true;
        this.idleAnimation.start_physics();   
    }


    start_revive_animation(ticks: number){
        this.graphics.graphics.clear();
        this.idleAnimation.start_body_reshaping();
    }

    make_visible(){
        this.ghost = false;

        this.runAnimation.container.visible = true;
        this.wallslideAnimation.container.visible = true;
        this.idleAnimation.container.visible = true;
        this.climbAnimation.container.visible = true;
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



