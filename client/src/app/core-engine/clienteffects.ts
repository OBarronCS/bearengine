import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";

import { SpriteEntity } from "./entity";
import { ShotInfo } from "./weapons/weaponinterfaces";
import { NetworkWriteSystem } from "./networking/networkwrite";
import { ClientPacket } from "shared/core/sharedlogic/packetdefinitions";


class Bullet extends SpriteEntity {
    constructor(pos: Coordinate){
        super(pos,"test2.png");
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
            

            const testTerrain = this.Terrain.lineCollision(this.bullet.position,Vec2.add(this.bullet.position, this.velocity.clone().extend(100)))

            if(testTerrain){
                this.Terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, 25);
                // Janky wow
                const network = this.Scene.getSystem(NetworkWriteSystem);
                network.queuePacket({
                    write(stream){
                        stream.setUint8(ClientPacket.TERRAIN_CARVE_CIRCLE);
                        stream.setFloat64(testTerrain.point.x)
                        stream.setFloat64(testTerrain.point.y)
                        stream.setInt32(25);
                    }
                })
                this.destroySelf();
            }

            if(!this.Level.bbox.contains(this.bullet.position)){
                this.destroySelf();
            }
        })
        
        this.onFinish( () => {
            this.Scene.destroyEntity(this.bullet);
        })
    }	
}




