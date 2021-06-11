import { Graphics } from "pixi.js";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { min } from "shared/mathutils"
import { random } from "shared/randomhelpers";
import { dimensions } from "shared/shapes/rectangle";
import { AbstractEntity } from "shared/core/abstractentity";

import { GraphicsPart, SpritePart } from "./parts";
import { BearEngine } from "./bearengine";
import { MouseInput } from "../input/mouse";
import { EngineKeyboard } from "../input/keyboard";
import { ColliderPart } from "shared/core/abstractpart";
import { TerrainManager } from "shared/core/terrainmanager";
import { GameLevel } from "./gamelevel";


// Client specific entity
export abstract class Entity extends AbstractEntity<BearEngine> {


    get terrain(): TerrainManager { return this.engine.terrain; }
    get mouse(): MouseInput { return this.engine.mouse; }
    get keyboard(): EngineKeyboard { return this.engine.keyboard; }
    get level(): GameLevel { return this.engine.activeLevel; } 

    // Used for quick movement implementation
    simpleMovement(speed: number): Coordinate {
        const check = this.simpleKeyboardCheck();

        this.x += check.x * speed;
        this.y += check.y * speed;

        return check;
    }

    simpleKeyboardCheck(magnitude: number = 1): Coordinate {
        return {
            x: magnitude * (+this.keyboard.isDown("KeyD") - +this.keyboard.isDown("KeyA")), 
            y: magnitude * (+this.keyboard.isDown("KeyS") - +this.keyboard.isDown("KeyW"))
        }
    }

    simpleKeyboardPressedCheck(magnitude: number = 1): Coordinate {
        return {
            x: magnitude * (+this.keyboard.wasPressed("KeyD") - +this.keyboard.wasPressed("KeyA")), 
            y: magnitude * (+this.keyboard.wasPressed("KeyS") - +this.keyboard.wasPressed("KeyW"))
        }
    }
}

export abstract class DrawableEntity extends Entity {
    
    protected canvas: GraphicsPart = this.addPart(new GraphicsPart());

    redraw(clear = true){
        if(clear) this.canvas.graphics.clear();
        this.draw(this.canvas.graphics);
    }

    abstract draw(g: Graphics): void;
}

export abstract class SpriteEntity extends Entity {
    // maybe name it "sprite" and not "image";
    public image: SpritePart;
    public collider: ColliderPart;

    constructor(spot: Coordinate, spr_source: string){
        super();

        this.position.set(spot);

        this.image = new SpritePart(spr_source);
        this.addPart(this.image);

        this.collider = new ColliderPart(dimensions(this.image.width, this.image.height), this.image.origin);
        this.collider.setPosition(spot)
        this.addPart(this.collider);
    }

}


export abstract class GMEntity extends SpriteEntity {
    public readonly velocity: Vec2 = new Vec2(0,0);
    public readonly startPosition: Vec2 = new Vec2(0,0);
    public readonly gravity: Vec2 = new Vec2(0,0);

    constructor(spot: Coordinate,spr_source: string){
        super(spot, spr_source);
        this.startPosition.set(spot);
    }

    postUpdate(){
        this.position.add(this.velocity);
        this.position.add(this.gravity);
    }

    /** Teleports to a random position aligned to dx and dy intervals, within width and height */
    randomPositionSnap(dx: number,dy: number,width: number, height: number){
        const x = dx * Math.round(random(width) / dx);
        const y = dy * Math.round(random(height) / dy);
        this.position.x = x;
        this.position.y = y;
    }

    // A temporary vector used for convenience so no need to create a new one each time
    private static moveTowards = new Vec2(0,0);
    // Move this to vector class?
    moveTowards(point: Coordinate, distance: number){
        GMEntity.moveTowards.x = point.x - this.position.x;
        GMEntity.moveTowards.y = point.y - this.position.y;
        
        GMEntity.moveTowards.extend(min(Vec2.distance(this.position,point),distance));
        this.position.add(GMEntity.moveTowards);
    }

}




