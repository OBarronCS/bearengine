import { Effect } from "../effecthandler";
import { Vec2 } from "../../../../../shared/shapes/vec2";
import { Entity, SpriteEntity } from "../entity";
import { Sprite, Point, graphicsUtils, Graphics } from "pixi.js";
import { E } from "../globals";
import { ShotInfo } from "../weapons/weaponinterfaces";
import { SpritePart } from "../parts";


export class DefaultBulletEffect extends Effect {
    public position: Vec2;
    public velocity: Vec2;
    public bullet: Entity;

    constructor(posVec: Vec2, velocityVec: Vec2, shotInfo: ShotInfo){
        super();
        // INITIAL POSITION ONLY AS OF NOW
        this.position = posVec;
        this.velocity = velocityVec;

        // Temp class here for testing
        class Bullet extends SpriteEntity {
            constructor(){
                super({x: 0, y: 0},"images/flower.png");
                this.image.originPercent = new Vec2(.5,.5);
            }

            update(dt: number): void {

            }

            draw(g: Graphics): void {

            }
        }

        this.onStart(() => {
            this.bullet = E.Engine.addEntity(new Bullet());
            this.bullet.position.set(this.position);
        })
        
        this.onUpdate(() => {
            this.bullet.position.add(this.velocity);
            
            if(!E.Level.bbox.contains(this.bullet.position)){
                this.destroy_effect = true;
            }
        })
        
        this.onFinish( () => {
            E.Engine.destroyEntity(this.bullet)
        })
    }	
}




