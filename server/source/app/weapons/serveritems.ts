import { Effect } from "shared/core/effects";
import { Clip, CreateShootController, GunshootController, SimpleWeaponControllerDefinition } from "shared/core/sharedlogic/weapondefinitions";
import { TickTimer } from "shared/datastructures/ticktimer";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";

import { TerrainCarveCirclePacket } from "../networking/gamepacketwriters";
import { networkedclass_server, sync } from "../networking/serverentitydecorators";
import { ServerBearEngine } from "../serverengine";

import { CreateItemData, GunItemData, ItemData } from "shared/core/sharedlogic/items";
import { ConnectionID } from "../networking/serversocket";

export class ServerItem<T extends ItemData> {
    item_data: T;

    constructor(item_data: T){
        this.item_data = item_data;
    }

    get item_type(){ return this.item_data.item_type; }
    get item_name(){ return this.item_data.item_name; }
    get item_id(){ return this.item_data.item_id; }
    get item_sprite(){ return this.item_data.item_sprite; }
}

abstract class Gun<T extends ItemData> extends ServerItem<T> {

    readonly position = new Vec2();
    readonly direction = new Vec2();

    reloading = false;

    triggerHeldThisTick = false;

    // holdTrigger(){
    //     this.triggerHeldThisTick = true;
    // }

    // update(dt: number): void {
    //     if(this.shootController.holdTrigger(this.triggerHeldThisTick)){
    //         if(this.clip.ammo > 0){
    //             this.clip.ammo -= 1;

    //             this.shoot();
    //         }
    //     }

    //     this.triggerHeldThisTick = false;
    // }

    abstract shoot(game: ServerBearEngine): void;
}

export function ServerShootHitscanWeapon(game: ServerBearEngine, shotID: number, position: Vec2, end: Vec2, owner: ConnectionID){
    
    const ray = new Line(position, end);

    // Check each players distance to the line.
    for(const pEntity of game.activeScene.activePlayerEntities.values()){
        if(pEntity.connectionID === owner) continue;

        if(ray.pointDistance(pEntity.position) < 30){
            pEntity.health -= 16;
        }
    } 

}

interface GunAddon {
    modifyShot: (bullet: ModularBullet) => void,
    [key: string]: any; // allow for random data
}

class ModularGun<T extends ItemData> extends Gun<T> {

    addons: GunAddon[] = [];

    constructor(data: T, addons: GunAddon[]){
        super(data);
        this.addons.push(...addons);
    }

    shoot(game: ServerBearEngine){
        const bullet = new ServerBullet();
            
        bullet.position.set(this.position);

        bullet.velocity = this.direction.clone().extend(25);


        for(const addon of this.addons){
            addon.modifyShot(bullet);
        }
    
        game.createRemoteEntity(bullet);
    }
}

class ModularBullet extends Effect<ServerBearEngine> {
    
    stateHasBeenChanged = false;
    markDirty(): void {
        this.stateHasBeenChanged = true;
    }

    velocity = new Vec2(0,0);

    constructor(){
        super();

        this.position.add({x:1,y:1});
    
        this.onUpdate(function(dt: number){
            this.position.add(this.velocity)
            if(!this.game.activeScene.levelbbox.contains(this.position)){
                this.destroy();
            }
        });
    }

    override destroy(){
        this.game.destroyRemoteEntity(this);
    }
} 


export function ServerShootTerrainCarver(game: ServerBearEngine, shotID: number, position: Vec2, velocity: Vec2){

    const bullet = new ModularBullet();

    bullet.position.set(position);
    bullet.velocity.set(velocity);
    
    bullet.onUpdate(function(){
        const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
        
        const RADIUS = 40;
        const DMG_RADIUS = 80;

        if(testTerrain){
            this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

            this.game.enqueueGlobalPacket(
                new TerrainCarveCirclePacket(testTerrain.point.x, testTerrain.point.y, RADIUS, shotID)
            );

            const point = new Vec2(testTerrain.point.x,testTerrain.point.y);

            // Check in radius to see if any players are hurt
            for(const pEntity of this.game.activeScene.activePlayerEntities.values()){

                if(Vec2.distanceSquared(pEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
                    pEntity.health -= 16;
                }
            } 
             
            this.destroy();
        }
    });

    const grav = new Vec2(0,.35);

    bullet.onUpdate(function(){
        this.velocity.add(grav);
    });

    game.entities.addEntity(bullet);
}



@networkedclass_server("bullet")
export class ServerBullet extends ModularBullet {
    
    @sync("bullet").var("_pos")
    _pos = new Vec2(1,1);

    @sync("bullet").var("test", true)
    test = 1;

    constructor(){
        super();
        this.velocity.set({x:1,y:1})
    }

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

