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

class Hitscan extends Gun<GunItemData> {

    readonly shootController: GunshootController;
    // readonly clip: Clip;


    constructor(item_data: GunItemData){
        super(item_data);
        this.shootController = CreateShootController(item_data.shoot_controller);
    }


    shoot(game: ServerBearEngine): void {
        const ray = new Line(this.position, Vec2.add(this.position, this.direction.extend(1000)));


        // Check in radius to see if any players are hurt
        for(const client of game.clients){

            const p = game.players.get(client);

            if(ray.pointDistance(p.playerEntity.position) < 30){
                p.playerEntity.health -= 16;
            }
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
    
        this.onUpdate(function(dt: number){
            this.position.add(this.velocity)
            if(!this.game.levelbbox.contains(this.position)){
                this.destroy();
            }
        });
    }

    override destroy(){
        this.game.destroyRemoteEntity(this);
    }
} 




// const ServerTerrainHitAddon: GunAddon = {

//     modifyShot(bullet: ModularBullet){
//         bullet.onUpdate(function(){
//             const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
            
//             const RADIUS = 40;
//             const DMG_RADIUS = 80;

//             if(testTerrain){
//                 this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

//                 this.game.enqueueGlobalPacket(
//                     new TerrainCarveCirclePacket(testTerrain.point.x, testTerrain.point.y, RADIUS)
//                 );

//                 const point = new Vec2(testTerrain.point.x,testTerrain.point.y);

//                 // Check in radius to see if any players are hurt
//                 for(const client of this.game.clients){
//                     const p = this.game.players.get(client);

//                     if(Vec2.distanceSquared(p.playerEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
//                         p.playerEntity.health -= 16;
//                     }
//                 } 
                 
//                 this.destroy();
//             }
//         })
//     }
// }


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
            for(const client of this.game.clients){
                const p = this.game.players.get(client);

                if(Vec2.distanceSquared(p.playerEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
                    p.playerEntity.health -= 16;
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



// class TerrainCarverGun extends ModularGun<GunItemData> {

//     constructor(){
//         super(
//             CreateItemData("terrain_carver"),
//             [
//             new TerrainHitAddon(),
//             {
//                 modifyShot(bullet){
//                     bullet.onInterval(2, function(times){
//                         this.velocity.drotate(random_range(-6,6))
//                     })
//                 }
//             },
//             {
//                 gravity: new Vec2(0,.35),
//                 modifyShot(effect){
        
//                     const self = this;
        
//                     effect.onUpdate(function(){
//                         this.velocity.add(self.gravity);
//                     })
//                 }
//             },
//         ])
//     }
// }





@networkedclass_server("bullet")
export class ServerBullet extends ModularBullet {
    
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
