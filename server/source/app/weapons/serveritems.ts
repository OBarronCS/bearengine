import { Effect } from "shared/core/effects";
import { Clip, CreateShootController, GunshootController, SHOT_LINKER, SimpleWeaponControllerDefinition } from "shared/core/sharedlogic/weapondefinitions";
import { TickTimer } from "shared/datastructures/ticktimer";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";

import { TerrainCarveCirclePacket, ProjectileShotPacket } from "../networking/gamepacketwriters";
import { networkedclass_server, sync } from "../networking/serverentitydecorators";
import { ServerBearEngine } from "../serverengine";

import { ConnectionID } from "../networking/serversocket";
import { ServerEntity } from "../entity";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { ServerPlayerEntity } from "../playerlogic";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";
import { SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";

export class SBaseItem<T extends keyof SharedNetworkedEntities> extends ServerEntity {

    constructor(public item_id: number){
        super();
    }

    GetStaticValue<K extends keyof Test<T>>(key: K): Test<T>[K] {
        //@ts-expect-error
        return MIGRATED_ITEMS[ITEM_LINKER.IDToName(this.item_id)][key]
    }

    update(dt: number): void {}

}


//@ts-expect-error
@networkedclass_server("weapon_item")
export abstract class SWeaponItem extends SBaseItem<"weapon_item"> {

    readonly direction = new Vec2();
    readonly shootController: GunshootController; // this.shootController = CreateShootController(item_data.shoot_controller);

    @sync("weapon_item").var("ammo")
    ammo: number = this.GetStaticValue("ammo");

    @sync("weapon_item").var("capacity")
    capacity: number = this.GetStaticValue("capacity");

    @sync("weapon_item").var("reload_time")
    reload_time: number = this.GetStaticValue("reload_time")

}

//@ts-expect-error
@networkedclass_server("projectile_weapon")
export class SProjectileWeaponItem extends SWeaponItem {

    //@ts-expect-error
    initial_speed: number = this.GetStaticValue("initial_speed");

    //@ts-expect-error
    shot_name = this.GetStaticValue("shot_name");

    //@ts-expect-error
    shot_id = SHOT_LINKER.NameToID(this.shot_name);
}

//@ts-expect-error
@networkedclass_server("hitscan_weapon")
export class SHitscanWeapon extends SWeaponItem {

}

// @ts-expect-error
@networkedclass_server("forcefield_item")
export class ForceFieldItem_S extends SBaseItem<"forcefield_item"> {
    
    radius = this.GetStaticValue("radius");

} 

export class ForceFieldEffect extends ServerEntity {

    constructor(public targetPlayer: ServerPlayerEntity, public radius: number){
        super();
    }

    update(dt: number): void {
        if(this.targetPlayer.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.targetPlayer.position);
        } else {
            this.destroy();
        }
    }

}




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

@networkedclass_server("projectile_bullet")
class ModularBullet extends Effect<ServerBearEngine> {
    
    stateHasBeenChanged = false;
    markDirty(): void {
        this.stateHasBeenChanged = true;
    }


    last_force_field_id = NULL_ENTITY_INDEX;


    @sync("projectile_bullet").var("velocity")
    velocity = new Vec2(0,0);

    constructor(){
        super();

        // Is immediately destroyed if starts at (0,0)
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


export function ServerShootProjectileWeapon(game: ServerBearEngine, shotID: number, position: Vec2, velocity: Vec2, shot_prefab_id: number): ModularBullet {

    const bullet = new ModularBullet();

    bullet.position.set(position);
    bullet.velocity.set(velocity);
    

    const shot_data = SHOT_LINKER.IDToData(shot_prefab_id);

    const on_hit_terrain_effects = shot_data.on_terrain;

    for(const effect of on_hit_terrain_effects){
        // Only add terrain hitting ability if have boom effect
        const type = effect.type;
        switch(type){

            case "particle": {
                // Not relevent to the server
                break;
            }

            case "gravity": {

                const grav = new Vec2().set(effect.force);

                bullet.onUpdate(function(){
                    this.velocity.add(grav);
                });

                break;
            }

            case "boom": {
                bullet.onUpdate(function(){
                    
                    const line = new Line(this.position,Vec2.add(this.position, this.velocity.clone().extend(50)));

                    for(const entity of this.game.entities.entities){
                        if(entity instanceof ForceFieldEffect){
                            if(entity.entityID === this.last_force_field_id) continue;

                            const test = Line.CircleLineIntersection(line.A, line.B, entity.x, entity.y, entity.radius);

                            if(test.points.length > 0){
                                this.last_force_field_id = entity.entityID;

                                // console.log("WE HAVE A HIT")
                                const bounceOffOf = test.points[0];
                                const normal = Vec2.subtract(bounceOffOf, entity.position);

                                const len = this.velocity.length();
                                Vec2.bounce(this.velocity.clone().normalize(),normal.clone().normalize(),this.velocity);
                                this.velocity.extend(len);
                                
                                this.position.set(bounceOffOf);

                                this.game.callEntityEvent(bullet, "projectile_bullet", "changeTrajectory",0,this.position.clone(), this.velocity.clone());

                                // this.game.enqueueGlobalPacket(
                                //     new ProjectileShotPacket(-1, shotID, 0, this.position.clone(), this.velocity.clone(), shot_prefab_id)
                                // );

                                break;
                            }
                        }
                    }
                

                    const testTerrain = this.game.terrain.lineCollision(line.A, line.B);
                    
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

    

    game.entities.addEntity(bullet);

    return bullet;
}


const item_gravity = new Vec2(0,3);

//@ts-expect-error
@networkedclass_server("item_entity")
export class ItemEntity extends ServerEntity {

    item: SBaseItem<any>

    @sync("item_entity").var("item_id")
    item_id = 0;

    @sync("item_entity").var("pos")
    pos = new Vec2(0,0)


    private active = true;

    constructor(item: SBaseItem<any>){
        super();
        this.item = item;
        this.item_id = item.item_id;

        this.markDirty();
    }

    update(dt: number): void {
        if(this.active){
            if(this.game.terrain.lineCollision(this.pos, Vec2.add(this.pos, item_gravity)) !== null){
                this.active = false;
                // console.log("hit")
            } else {
                this.pos.add(item_gravity);
                this.markDirty()
            }
        }
        
    }

}

