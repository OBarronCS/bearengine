import { Effect } from "../effecthandler";
import { Vec2 } from "../../math-library/vec2";
import { Entity } from "../entity";
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
        class Bullet extends Entity {
            constructor(){
                super();
                const spr2 = new Sprite(E.Engine.renderer.getTexture("images/flower.png"))
                spr2.anchor = new Point(.5,.5);
                const spr = new SpritePart(spr2)
                
                this.addPart(spr);
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




