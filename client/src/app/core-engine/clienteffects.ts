import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";

import { SpriteEntity } from "./entity";
import { ShotInfo } from "./weapons/weaponinterfaces";


class Bullet extends SpriteEntity {
    constructor(pos: Coordinate){
        super(pos,"images/test2.png");
        this.image.originPercent = new Vec2(.5,.5);
    }

    update(dt: number): void {}
    draw(g: Graphics): void {}
}

export class DefaultBulletEffect extends Effect {
    public position: Vec2;
    public velocity: Vec2;
    public bullet: Bullet;

    constructor(posVec: Readonly<Vec2>, velocityVec: Vec2, shotInfo: ShotInfo){
        super();

        // Initial position
        this.position = posVec.clone();
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




