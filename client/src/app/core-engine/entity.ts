import { Graphics } from "pixi.js";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { min } from "shared/miscmath"
import { random } from "shared/randomhelpers";
import { ColliderPart } from "shared/core/sharedparts"
import { dimensions } from "shared/shapes/rectangle";
import { AbstractEntity } from "shared/core/abstractentity";

import { SpritePart } from "./parts";
import { E } from "./globals";

// Client specific entity
export abstract class Entity extends AbstractEntity {
    readonly graphics: Graphics

    constructor() {
        super()
        this.graphics = new Graphics();
    }

    redraw(){
        this.draw(this.graphics);
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
    // Does NOT overshoot
    moveTowards(point: Coordinate, distance: number){
        GMEntity.moveTowards.x = point.x - this.position.x;
        GMEntity.moveTowards.y = point.y - this.position.y;
        
        GMEntity.moveTowards.extend(min(Vec2.distance(this.position,point),distance));
        this.position.add(GMEntity.moveTowards);
    }

}



// Used for quick movement implementing
export function SimpleMovement(e: Entity, speed: number){
    const horz_move = +E.Keyboard.isDown("KeyD") - +E.Keyboard.isDown("KeyA");
    const vert_move = +E.Keyboard.isDown("KeyS") - +E.Keyboard.isDown("KeyW");

    e.x += horz_move * speed;
    e.y += vert_move * speed;
}

export function SimpleKeyboardCheck(magnitude: number = 1): Coordinate {
    return {
        x: magnitude * (+E.Keyboard.isDown("KeyD") - +E.Keyboard.isDown("KeyA")), 
        y: magnitude * (+E.Keyboard.isDown("KeyS") - +E.Keyboard.isDown("KeyW"))
    }
}
