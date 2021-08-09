import { Vec2 } from "shared/shapes/vec2";
import { Clip, CreateShootController, GunshootController } from "server/source/app/weapons/weapondefinitions";

import { ServerEntity } from "../entity";
import { networkedclass_server, sync } from "../networking/serverentitydecorators";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Effect } from "shared/core/effects";
import { ServerBearEngine } from "../serverengine";
import { Line } from "shared/shapes/line";
import { TickTimer } from "shared/datastructures/ticktimer";
import { TerrainCarveCirclePacket } from "../networking/gamepacketwriters";


export abstract class Gun extends ServerEntity {

    readonly shootController: GunshootController;
    readonly clip: Clip

    // owner: ServerEntity;

    direction = new Vec2(0,0);

    reloading = false;

    triggerHeldThisTick = false;

    constructor(shootController: GunshootController, clip: Clip){
        super();
        this.shootController = shootController;
        this.clip = clip;
    }

    holdTrigger(){
        this.triggerHeldThisTick = true;
    }

    reload(){

    }

    update(dt: number): void {
        if(this.shootController.holdTrigger(this.triggerHeldThisTick)){
            if(this.clip.ammo > 0){
                this.clip.ammo -= 1;

                this.shoot();
            }
        }

        this.triggerHeldThisTick = false;
    }

    abstract shoot(): void;
}

export class Hitscan extends Gun {

    constructor(){
        super(CreateShootController({type:"semiauto", time_between_shots: 10}), new Clip(999,999,999));
    }

    shoot(): void {
        const ray = new Line(this.position, Vec2.add(this.position, this.direction.extend(1000)));


        // Check in radius to see if any players are hurt
        for(const client of this.game.clients){

            const p = this.game.players.get(client);

            if(ray.pointDistance(p.playerEntity.position) < 30){
                p.playerEntity.health -= 16;
            }
        } 
    }

}


export class ModularGun extends Gun {

    addons: GunAddon[] = [];

    constructor(shootController: GunshootController, clip: Clip, addons: GunAddon[]){
        super(shootController, clip);
        this.addons.push(...addons);
    }

    shoot(){
        const bullet = new ServerBullet();
            
        bullet.position.set(this.position);

        bullet.velocity = this.direction.clone().extend(25);


        for(const addon of this.addons){
            addon.modifyShot(bullet);
        }
    
        this.game.createRemoteEntity(bullet);
    }
}

interface GunAddon {
    modifyShot: (bullet: ProjectileBullet) => void,
    [key: string]: any; // allow for random data
}

export class ProjectileBullet extends Effect<ServerBearEngine> {
    
    stateHasBeenChanged = false;
    markDirty(): void {
        this.stateHasBeenChanged = true;
    }


    velocity = new Vec2(0,0);

    constructor(){
        super();
    
        this.onUpdate(function(dt: number){
            if(!this.game.levelbbox.contains(this.position)){
                this.destroy();
            }
        });
    }

    override destroy(){
        this.game.destroyRemoteEntity(this);
    }
} 


export class TerrainHitAddon implements GunAddon {

    modifyShot(bullet: ProjectileBullet){
        bullet.onUpdate(function(){
            const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
            
            const RADIUS = 40;
            const DMG_RADIUS = 80;

            if(testTerrain){
                this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

                this.game.enqueueGlobalPacket(
                    new TerrainCarveCirclePacket(testTerrain.point.x, testTerrain.point.y, RADIUS)
                );

                const point = new Vec2(testTerrain.point.x,testTerrain.point.y);

                // Check in radius to see if any players are hurt
                for(const client of this.game.clients){
                    const p = this.game.players.get(client);

                    if(Vec2.distanceSquared(p.playerEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
                        p.playerEntity.health -= 16;
                    }
                } 
                 
                this.destroy();
            }
        })
    }
}

@networkedclass_server("bullet")
export class ServerBullet extends ProjectileBullet {
    
    @sync("bullet").var("_pos")
    _pos = new Vec2(0,0);

    @sync("bullet").var("test", true)
    test = 1;

    private t = new TickTimer(10, false);

    override update(dt: number): void {
        super.update(dt);

        this.position.add(this.velocity);
        
        this._pos.set(this.position);

        this.markDirty();


        if(this.t.tick()){
           this.game.callEntityEvent(this, "bullet", "testEvent7", {arr: ["asd"], otherValue: new Vec2(23,31), x : 1}, 123);
        }

        // this.test += 1;
    }
}

