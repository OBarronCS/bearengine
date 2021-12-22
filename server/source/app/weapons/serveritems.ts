import { Effect, Effect2 } from "shared/core/effects";
import { Clip, CreateShootController, GunshootController, SHOT_LINKER, SimpleWeaponControllerDefinition } from "shared/core/sharedlogic/weapondefinitions";
import { TickTimer } from "shared/datastructures/ticktimer";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";

import { TerrainCarveCirclePacket } from "../networking/gamepacketwriters";
import { networkedclass_server, NetworkedEntity, sync } from "../networking/serverentitydecorators";
import { ServerBearEngine } from "../serverengine";

import { ConnectionID } from "../networking/serversocket";
import { ServerEntity } from "../entity";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { ServerPlayerEntity } from "../playerlogic";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";
import { SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { EntityID } from "shared/core/abstractentity";
import { Rect } from "shared/shapes/rectangle";
import { Ellipse } from "shared/shapes/ellipse";

export class SBaseItem<T extends keyof SharedNetworkedEntities> extends NetworkedEntity<T> {

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

//@ts-expect-error
@networkedclass_server("forcefield_effect")
export class ForceFieldEffect extends NetworkedEntity<"forcefield_effect"> {

    @sync("forcefield_effect").var("radius", true)
    radius: number 

    @sync("forcefield_effect").var("player_id",true)
    player_id: EntityID

    constructor(public targetPlayer: ServerPlayerEntity, radius: number){
        super();
        
        this.player_id = targetPlayer.connectionID;
        this.radius = radius;
    }

    timer = new TickTimer(60 * 7);

    update(dt: number): void {
        if(this.targetPlayer.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.targetPlayer.position);
            if(this.targetPlayer.dead) this.destroy()
        } else {
            this.destroy();
        }

        if(this.timer.tick()) this.destroy();

    }

    override destroy(){
        this.game.destroyRemoteEntity(this);
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
    modifyShot: (bullet: ServerProjectileBullet) => void,
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


export function ServerShootHitscanWeapon(game: ServerBearEngine, position: Vec2, end: Vec2, owner: ConnectionID){
    
    const ray = new Line(position, end);

    // Check each players distance to the line.
    for(const pEntity of game.activeScene.activePlayerEntities.values()){
        if(pEntity.connectionID === owner) continue;

        if(ray.pointDistance(pEntity.position) < 30){
            pEntity.health -= 16;
        }
    } 

}

//@ts-expect-error
@networkedclass_server("projectile_bullet")
class ServerProjectileBullet extends NetworkedEntity<"projectile_bullet"> {
 
    effect = new Effect2(this);

    update(dt: number): void {
        this.effect.update(dt);
    }

    override onAdd(): void {
        this.effect.onAdd();
    }

    override onDestroy(): void {
        this.effect.onDestroy()
    }
    

    last_force_field_id = NULL_ENTITY_INDEX;


    @sync("projectile_bullet").var("velocity")
    velocity = new Vec2(0,0);

    circle: Ellipse;

    constructor(circle: Ellipse, public creatorID: number){
        super();

        this.circle = circle;

        // Is immediately destroyed if starts at (0,0)
        this.position.add({x:1,y:1});
    
        this.effect.onUpdate(function(dt: number){
            this.position.add(this.velocity);
            this.circle.position.set(this.position);

            if(!this.game.activeScene.levelbbox.contains(this.position)){
                this.destroy();
            }
        });
    }

    override destroy(){
        this.game.destroyRemoteEntity(this);
    }
} 


export function ServerShootProjectileWeapon(game: ServerBearEngine, creatorID: number, position: Vec2, velocity: Vec2, shot_prefab_id: number): ServerProjectileBullet {

    const bullet = new ServerProjectileBullet(new Ellipse(new Vec2(),20,20), creatorID);

    bullet.position.set(position);
    bullet.velocity.set(velocity);
    
    // Bouncing off of forcefields
    bullet.effect.onUpdate(function(dt){
                            
        const line = new Line(this.position,Vec2.add(this.position, this.velocity.clone()));
        
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

        for(const player of this.game.activeScene.activePlayerEntities.values()){
            if(player.connectionID === this.creatorID) continue;
            const point = Line.PointClosestToLine(line.A, line.B, player.position);
            if(Vec2.distanceSquared(player.position, point) < 30 * 30 ){
                player.health -= 10;
                this.destroy();
            }
        }
    })

    const shot_data = SHOT_LINKER.IDToData(shot_prefab_id);

    const on_hit_terrain_effects = shot_data.bullet_effects;

    for(const effect of on_hit_terrain_effects){
        // Only add terrain hitting ability if have boom effect
        const type = effect.type;
        switch(type){
            case "emoji": break;
            case "particle_system": {
                // Not relevent to the server
                break;
            }

            case "gravity": {

                const grav = new Vec2().set(effect.force);

                bullet.effect.onUpdate(function(){
                    this.velocity.add(grav);
                });

                break;
            }
            case "laser_mine_on_hit": {
                bullet.effect.onUpdate(function(){
                    const line = new Line(this.position,Vec2.add(this.position, this.velocity.clone()));

                    

                    const testTerrain = this.game.terrain.lineCollision(line.A, line.B);
                    
                    // const RADIUS = 20;
                    // const DMG_RADIUS = effect.radius * 1.5;
            
                    if(testTerrain){

                        this.game.createRemoteEntity(new LaserTripmine_S(testTerrain.point, testTerrain.normal));

                        this.destroy();


                    }
                });

                break;
            }

            case "terrain_hit_boom": {
                bullet.effect.onUpdate(function(){
                    
                    const line = new Line(this.position,Vec2.add(this.position, this.velocity.clone().extend(50)));

                

                    const testTerrain = this.game.terrain.lineCollision(line.A, line.B);
                    
                    const RADIUS = effect.radius;
                    const DMG_RADIUS = effect.radius * 1.5;
            
                    if(testTerrain){
                        this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);
            
                        this.game.enqueueGlobalPacket(
                            new TerrainCarveCirclePacket(testTerrain.point.x, testTerrain.point.y, RADIUS)
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

    
    game.createRemoteEntityNoNotify(bullet);

    return bullet;
}


const item_gravity = new Vec2(0,3.8);

export enum ItemEntityPhysicsMode {
    ASLEEP,
    FLOATING,
    BOUNCING
}

//@ts-expect-error
@networkedclass_server("item_entity")
export class ItemEntity extends NetworkedEntity<"item_entity"> {

    override position: never

    item: SBaseItem<any>

    @sync("item_entity").var("item_id")
    item_id = 0;

    @sync("item_entity").var("pos")
    pos = new Vec2(0,0)

    mode: ItemEntityPhysicsMode = ItemEntityPhysicsMode.FLOATING;
    velocity = new Vec2();
        
    private slow_factor = 0.7;

    constructor(item: SBaseItem<any>){
        super();
        this.item = item;
        this.item_id = item.item_id;

        this.mark_dirty("item_id");
        this.mark_dirty("pos");
    }


    update(dt: number): void {

        const pos = this.pos.clone();

        switch(this.mode){
            case ItemEntityPhysicsMode.ASLEEP: break;
            case ItemEntityPhysicsMode.FLOATING: {

                const col = this.game.terrain.lineCollision(this.pos, Vec2.add(this.pos, item_gravity));
                if(col !== null){
                    this.pos.y = col.point.y - 15;
                    this.mode = ItemEntityPhysicsMode.ASLEEP;
                    // console.log("hit")
                } else {
                    this.pos.add(item_gravity);
                    this.mark_dirty("pos");
                }

                break;
            }
            case ItemEntityPhysicsMode.BOUNCING: {
                // THIS SIMULATES SUPER FAST, IDK WHY
                // It should be equal to client side, but...
                this.mark_dirty("pos");
                // Gravity
                this.velocity.add(item_gravity);



                const destination = Vec2.add(this.velocity,this.pos);

                // If no terrain hit, proceed
                const test = this.game.terrain.lineCollisionExt(this.pos, destination);

                if(test === null){
                    this.pos.add(this.velocity);
                } else {

                    if(this.velocity.length() <= 1){
                        this.mode = ItemEntityPhysicsMode.ASLEEP;
                    }
                    // Could potentially bounce multiple times;

                    let last_test = test;
                    let distanceToMove = this.velocity.length();

                    const max_iter = 20;
                    let i = 0;
                    while(distanceToMove > 0 && i++ < max_iter){


                        const distanceToPoint = Vec2.subtract(last_test.point,this.pos).length();

                        const distanceAfterBounce = distanceToMove - distanceToPoint;

                        // Set my position to colliding point, then do more logic later
                        this.pos.set(last_test.point);

                        // Bounce off of wall, set velocity
                        Vec2.bounce(this.velocity, last_test.normal, this.velocity);

                        const lastStretchVel = this.velocity.clone().normalize().scale(distanceAfterBounce);

                        // Slows done
                        this.velocity.scale(this.slow_factor);

                        distanceToMove -= distanceToPoint;
                        distanceToMove *= this.slow_factor;


                        // Move forward
                        const bounce_test = this.game.terrain.lineCollisionExt(this.pos, Vec2.add(this.pos, lastStretchVel));

                        if(bounce_test === null || bounce_test.normal.equals(last_test.normal) ){
                            this.pos.add(lastStretchVel);

                            if(this.game.terrain.pointInTerrain(this.pos)) this.mode = ItemEntityPhysicsMode.ASLEEP;
                            // console.log(Vec2.distance(pos, this.pos))
                            break;
                        }

                        last_test = bounce_test   
                    }


                }


                break;
            }
            default: AssertUnreachable(this.mode);
        }



    }

}



//@ts-expect-error
@networkedclass_server("laser_tripmine")
export class LaserTripmine_S extends NetworkedEntity<"laser_tripmine"> {

    @sync("laser_tripmine").var("__position")
    __position = new Vec2(0,0);

    @sync("laser_tripmine").var("direction")
    direction = new Vec2(0,0);

    line: Line;

    constructor(pos: Vec2, dir: Vec2){
        super();
        this.__position.set(pos);
        this.direction.set(dir);

        this.line = new Line(pos,Vec2.add(pos, dir.clone().extend(20)));

        this.mark_dirty("__position");
        this.mark_dirty("direction");
    }

    update(dt: number): void {


        for(const pEntity of this.game.activeScene.activePlayerEntities.values()){
            

            const p = Line.PointClosestToLine(this.line.A, this.line.B, pEntity.position);

            if(Vec2.distanceSquared(p,pEntity.position) < 20 * 20){

                this.game.terrain.carveCircle(this.__position.x, this.__position.y, 45);
            
                this.game.enqueueGlobalPacket(
                    new TerrainCarveCirclePacket(this.__position.x, this.__position.y, 45)
                );

                this.game.dmg_players_in_radius(this.__position, 50,20);
                 
                this.game.destroyRemoteEntity(this);

                break;
            }
        } 
    }


}









