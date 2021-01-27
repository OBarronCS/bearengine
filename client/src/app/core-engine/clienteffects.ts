import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";

import { Entity, SpriteEntity } from "./entity";
import { ShotInfo } from "./weapons/weaponinterfaces";


// Temp class here for testing
class Bullet extends SpriteEntity {
    constructor(pos: Coordinate){
        super(pos,"images/flower.png");
        this.image.originPercent = new Vec2(.5,.5);
    }

    update(dt: number): void {}
    draw(g: Graphics): void {}
}

export class DefaultBulletEffect extends Effect {
    public position: Vec2;
    public velocity: Vec2;
    public bullet: Entity;

    constructor(posVec: Vec2, velocityVec: Vec2, shotInfo: ShotInfo){
        super();
        // INITIAL POSITION ONLY AS OF NOW
        this.position = posVec;
        this.velocity = velocityVec;

        this.onStart(() => {
            this.bullet = this.Scene.addEntity(new Bullet(this.position));
            this.bullet.position.set(this.position);
        })
        
        this.onUpdate(() => {
            this.bullet.position.add(this.velocity);
            
            if(!this.Level.bbox.contains(this.bullet.position)){
                this.destroy_effect = true;
            }
        })
        
        this.onFinish( () => {
            this.Scene.destroyEntity(this.bullet)
        })
    }	
}




