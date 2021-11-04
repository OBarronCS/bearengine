import { Effect } from "shared/core/effects";
import { Clip, CreateShootController, GunshootController, SHOT_LINKER, SimpleWeaponControllerDefinition } from "shared/core/sharedlogic/weapondefinitions";
import { TickTimer } from "shared/datastructures/ticktimer";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";

import { TerrainCarveCirclePacket } from "../networking/gamepacketwriters";
import { networkedclass_server, sync } from "../networking/serverentitydecorators";
import { ServerBearEngine } from "../serverengine";

// import { ItemData } from "shared/core/sharedlogic/items";
import { ConnectionID } from "../networking/serversocket";
import { ServerEntity } from "../entity";
import { AssertUnreachable } from "shared/misc/assertstatements";

@networkedclass_server("weapon_item")
export abstract class SWeaponItem extends ServerEntity {

    readonly direction = new Vec2();
    readonly shootController: GunshootController;

    @sync("weapon_item").var("ammo")
    ammo: number;

    @sync("weapon_item").var("capacity")
    capacity: number;

    @sync("weapon_item").var("reload_time")
    reload_time: number;

    constructor(){
        super();
        // this.shootController = CreateShootController(item_data.shoot_controller);
    }

    update(dt: number){}

}

@networkedclass_server("terrain_carver_weapon")
export class STerrainCarverWeapon extends SWeaponItem {


}

@networkedclass_server("hitscan_weapon")
export class SHitscanWeapon extends SWeaponItem {


}





// export class ServerItem<T extends ItemData> {
//     item_data: T;

//     constructor(item_data: T){
//         this.item_data = item_data;
//     }

//     get item_type(){ return this.item_data.item_type; }
//     get item_name(){ return this.item_data.item_name; }
//     get item_id(){ return this.item_data.item_id; }
//     get item_sprite(){ return this.item_data.item_sprite; }
// }

// abstract class Gun<T extends ItemData> extends ServerItem<T> {

//     readonly position = new Vec2();
//     readonly direction = new Vec2();

//     reloading = false;

//     triggerHeldThisTick = false;

//     // holdTrigger(){
//     //     this.triggerHeldThisTick = true;
//     // }

//     // update(dt: number): void {
//     //     if(this.shootController.holdTrigger(this.triggerHeldThisTick)){
//     //         if(this.clip.ammo > 0){
//     //             this.clip.ammo -= 1;

//     //             this.shoot();
//     //         }
//     //     }

//     //     this.triggerHeldThisTick = false;
//     // }

//     abstract shoot(game: ServerBearEngine): void;
// }

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

// class ModularGun<T extends ItemData> extends Gun<T> {

//     addons: GunAddon[] = [];

//     constructor(data: T, addons: GunAddon[]){
//         super(data);
//         this.addons.push(...addons);
//     }

//     shoot(game: ServerBearEngine){
//         const bullet = new ServerBullet();
            
//         bullet.position.set(this.position);

//         bullet.velocity = this.direction.clone().extend(25);


//         for(const addon of this.addons){
//             addon.modifyShot(bullet);
//         }
    
//         game.createRemoteEntity(bullet);
//     }
// }

@networkedclass_server("projectile_bullet")
class ModularBullet extends Effect<ServerBearEngine> {
    
    stateHasBeenChanged = false;
    markDirty(): void {
        this.stateHasBeenChanged = true;
    }

    @sync("projectile_bullet").var("pos")
    pos = new Vec2(0,0)

    @sync("projectile_bullet").var("velocity")
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


export function ServerShootTerrainCarver(game: ServerBearEngine, shotID: number, position: Vec2, velocity: Vec2, shot_prefab_id: number): void {

    const bullet = new ModularBullet();

    bullet.position.set(position);
    bullet.velocity.set(velocity);
    

    const shot_data = SHOT_LINKER.ItemData(shot_prefab_id);

    const on_hit_terrain_effects = shot_data.on_terrain;

    for(const effect of on_hit_terrain_effects){
        // Only add terrain hitting ability if have boom effect
        const type = effect.type;
        switch(type){
            case "boom": {
                bullet.onUpdate(function(){
                    const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
                    
                    const RADIUS = effect.radius;
                    const DMG_RADIUS = effect.radius * 1.5;
            
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
                break;
            }
            default: AssertUnreachable(type)
        }  
    }

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

