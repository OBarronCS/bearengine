import { Effect, Effect2 } from "shared/core/effects";
import { Clip, CreateShootController, GunshootController, ItemActionAck, SHOT_LINKER, SimpleWeaponControllerDefinition } from "shared/core/sharedlogic/weapondefinitions";
import { TickTimer } from "shared/datastructures/ticktimer";
import { random_int, random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Coordinate, Vec2 } from "shared/shapes/vec2";

import { ForcePositionPacket, TerrainCarveCirclePacket } from "../networking/gamepacketwriters";
import { networkedclass_server, NetworkedEntity, sync } from "../networking/serverentitydecorators";
import { PlayerInformation, ServerBearEngine } from "../serverengine";
import { AttemptAction, link_item_action_attempt } from "../networking/serveritemactionlinker"


import { ConnectionID } from "../networking/serversocket";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { ServerPlayerEntity } from "../playerlogic";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";
import { SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { EntityID } from "shared/core/abstractentity";
import { Ellipse } from "shared/shapes/ellipse";
import { TerrainManager } from "shared/core/terrainmanager";
import { ServerEntity } from "../entity";
import { SimpleBouncePhysics } from "shared/core/sharedlogic/sharedphysics"
import { BoostDirection, BoostZone_S } from "./boostzones";
import { DEG_TO_RAD, floor } from "shared/misc/mathutils";
import { MatchGamemode } from "shared/core/sharedlogic/sharedenums";

export enum ItemActivationType {
    GIVE_ITEM,
    INSTANT
}

export class SBaseItem<T extends keyof SharedNetworkedEntities> extends NetworkedEntity<T> {

    public readonly activation_type: ItemActivationType = ItemActivationType.GIVE_ITEM;

    constructor(public item_id: number){
        super();
    }

    GetStaticValue<K extends keyof Test<T>>(key: K): Test<T>[K] {
        //@ts-expect-error
        return MIGRATED_ITEMS[ITEM_LINKER.IDToName(this.item_id)][key]
    }

    update(dt: number): void {}

    // Subclasses that use it can implement it
    do_action(creator: PlayerInformation): void {};

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
@networkedclass_server("shotgun_weapon")
export class ShotgunWeapon_S extends SProjectileWeaponItem {
    //@ts-expect-error
    count: number = this.GetStaticValue("count");

    //@ts-expect-error
    spread: number = this.GetStaticValue("spread");
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
export class ForceFieldEffect_S extends NetworkedEntity<"forcefield_effect"> {

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

//@ts-expect-error
@networkedclass_server("swap_item")
export class PlayerSwapperItem extends SBaseItem<"swap_item"> {
    public override activation_type = ItemActivationType.INSTANT;

    override do_action(creator: PlayerInformation): void {
        const all_players = this.game.active_scene.activePlayerEntities.values();

        if(all_players.length <= 1) {
            console.log("Cannot swap");
            return;
        }
        
        // Pick a random other player to swap with
        const other_player = all_players.filter(p => p !== creator.playerEntity)[random_int(0,all_players.length - 1)];

        creator.personalPackets.enqueue(
            new ForcePositionPacket(other_player.x, other_player.y)
        )

        this.game.enqueuePacketForClient(other_player.connectionID,
            new ForcePositionPacket(creator.playerEntity.x, creator.playerEntity.y)
        )
        
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


export function ServerShootHitscanWeapon(game: ServerBearEngine, position: Vec2, end: Vec2, owner: ConnectionID): Vec2 {
    
    const ray = new Line(position, end);

    const terrain = game.terrain.lineCollision(ray.A, ray.B);
    if(terrain) ray.B = terrain.point;

    // Check each players distance to the line.
    for(const pEntity of game.active_scene.activePlayerEntities.values()){
        if(pEntity.connectionID === owner) continue;

        if(ray.pointDistance(pEntity.position) < 30){
            pEntity.take_damage(16);
        }
    }

    return ray.B;

}

//@ts-expect-error
@networkedclass_server("projectile_bullet")
class ServerProjectileBullet extends NetworkedEntity<"projectile_bullet"> {
    
    private readonly player_dmg_radius = 30;
    
    allow_move = true;

    forward_line = new Line(this.position,this.position);

    terrain_test: ReturnType<TerrainManager["lineCollision"]> | null = null;
    
    // List of all players that the projectile will hit this tick
    player_test: ServerPlayerEntity[] = [];

    effect = new Effect2(this);

    private finalActionFunctions: (() => void)[] = [];
    onfinalAction(func:((this: this) => void)): this {
		const boundedFunc = func.bind(this);
		this.finalActionFunctions.push(boundedFunc)
		return this;
	}

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

    //hitbox
    circle: Ellipse;

    seconds_alive = 0;
    
    // This is set to false after it has but alive for some seconds
    ignore_creator_id = true;

    constructor(circle: Ellipse, public creatorID: number, public creatorEntityID: EntityID, public bounce: boolean){
        super();

        // Is immediately destroyed if starts at (0,0)
        this.position.add({x:1,y:1});

        this.circle = circle;

        this.effect.onUpdate(function(dt){
            this.seconds_alive += dt;

            if(this.seconds_alive > 0.15){
                this.ignore_creator_id = false;
            }

            this.forward_line.A = this.position;
            this.forward_line.B = Vec2.add(this.position, this.velocity);

            this.terrain_test = this.game.terrain.lineCollision(this.forward_line.A, this.forward_line.B);

            // Check collision with players, add to player_test list;
            for(const player of this.game.active_scene.activePlayerEntities.values()){

                if(this.ignore_creator_id && player.connectionID === this.creatorID) continue;

                const point = Line.PointClosestToLine(this.forward_line.A, this.forward_line.B, player.position);
                if(Vec2.distanceSquared(player.position, point) < this.player_dmg_radius**2){
                    this.player_test.push(player);
                }
            }


            // VOTING:
            if(this.terrain_test){
                if(this.terrain_test.mesh.tag === "vote"){
                    this.game.player_vote_start(this.creatorID, MatchGamemode.INFINITE);
                }
            }

                    
            if(!this.bounce){
                if(this.terrain_test || this.player_test.length !== 0){
                    if(this.terrain_test) this.position.set(this.terrain_test.point);
                    else this.position.set(this.player_test[0].position);

                    for(const func of this.finalActionFunctions){
                        func();
                    }

                    this.destroy();
                }
            } else {
                if(this.seconds_alive > 2.5 || this.player_test.length !== 0){
                    if(this.player_test.length !== 0) this.position.set(this.player_test[0].position);

                    for(const func of this.finalActionFunctions){
                        func();
                    }

                    this.destroy();
                }
            }
        });

    }

    _destroyed = false;
    override destroy(){
        // This might be called multiple times
        if(this._destroyed) return;
        this._destroyed = true;
        
        this.game.callEntityEvent(this, "projectile_bullet", "finalPosition", this.position, 0);
        this.allow_move = false;
        this.game.destroyRemoteEntity(this);
    }
} 


/** Adds bullet to game world and returns it */
export function ServerShootProjectileWeapon(game: ServerBearEngine, creatorID: PlayerInformation, position: Vec2, velocity: Vec2, shot_prefab_id: number, mouse: Vec2): ServerProjectileBullet {

    const bullet = new ServerProjectileBullet(new Ellipse(new Vec2(),20,20), creatorID.connectionID, creatorID.playerEntity.entityID, SHOT_LINKER.IDToData(shot_prefab_id).bounce);

    bullet.position.set(position);
    bullet.velocity.set(velocity);


    const shot_data = SHOT_LINKER.IDToData(shot_prefab_id);
    const on_hit_terrain_effects = shot_data.bullet_effects;

    // Bouncing off of forcefields
    bullet.effect.onUpdate(function(dt){

        const line = this.forward_line;
        
        for(const entity of this.game.entities.entities){
            if(entity instanceof ForceFieldEffect_S){
                if(this.ignore_creator_id && entity.targetPlayer.entityID === this.creatorEntityID) continue;
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

                    break;
                }
            }
        }
    });

    for(const effect of on_hit_terrain_effects){
        // Only add terrain hitting ability if have boom effect
        const type = effect.type;
        switch(type){
            case "emoji": break;
            case "particle_system": break;
            case "ice_slow": break;
            case "paint_ball": break;
            case "goto_mouse": {
                break;
            }
            case "destroy_after":{

                const time = effect.seconds;

                const final_pos = mouse.clone();

                bullet.effect.onUpdate(function(dt){
                    if(this.seconds_alive >= time){

                        this.position.set(final_pos);
                        this.destroy();
                    }
                });

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
                bullet.onfinalAction(function(){

                    const RADIUS = 20;
                    // const DMG_RADIUS = effect.radius * 1.5;

                    if(this.terrain_test){
                        this.game.createRemoteEntity(new LaserTripmine_S(this.terrain_test.point, this.terrain_test.normal));

                    } else if(this.player_test.length !== 0){
                        for(const p of this.player_test){
                            p.take_damage(25);
                        }

                        this.game.terrain.carveCircle(this.position.x, this.position.y, RADIUS);
        
                        this.game.enqueueGlobalPacket(
                            new TerrainCarveCirclePacket(this.position.x, this.position.y, RADIUS)
                        );
                    }            
                });

                break;
            }
            case "terrain_hit_boom": {
                bullet.onfinalAction(function(){
                    
                    const RADIUS = effect.radius;
                    const DMG_RADIUS = effect.radius * 1;
            
                
                    this.game.terrain.carveCircle(this.position.x, this.position.y, RADIUS);
        
                    this.game.enqueueGlobalPacket(
                        new TerrainCarveCirclePacket(this.position.x, this.position.y, RADIUS)
                    );
            

                    this.game.dmg_players_in_radius(this.position, DMG_RADIUS, 25);

                });
                break;
            }
            default: AssertUnreachable(type)
        }  
    }

    // damaging players on hit
    if(shot_data.damage > 0){
        bullet.onfinalAction(function(){
            if(this.player_test.length !== 0){
                for(const p of this.player_test){
                    p.take_damage(shot_data.damage);
                }
            }
        });
    }

    // Move at the very end, if all checks are valid
    bullet.effect.onUpdate(function(dt: number){
        if(this.allow_move){

            const slow_zones_s = this.game.collision.point_query_list(this.position, BoostDirection);
            for(const s of slow_zones_s){
                this.velocity.add(s.attr.dir);
            }

            if(this.bounce){

                const status = SimpleBouncePhysics(this.game.terrain, this.position, this.velocity, new Vec2(0, .4), .6);

                // if(status.stopped){
                //     this.destroy();
                // }
            } else {    
                this.position.add(this.velocity);
                this.circle.position.set(this.position);
                if(this.terrain_test) this.destroy();
            }
        }

        if(!this.game.active_scene.level_bbox.contains(this.position)){
            this.destroy();
        }
    });

    game.createRemoteEntityNoNotify(bullet);

    return bullet;
}



export function ShootShotgunWeapon_S(game: ServerBearEngine, creator: PlayerInformation, shotgun_id: number, shot_id: number, position: Vec2, direction: Vec2): ServerProjectileBullet[] {

    const shotgun_data = ITEM_LINKER.IDToData(shotgun_id) as Test<"shotgun_weapon">;
    const initial_speed = shotgun_data.initial_speed;
    const count = shotgun_data.count;
    const spread_rad = shotgun_data.spread * DEG_TO_RAD;
    

    let current_dir = direction.angle() - (floor(count / 2)*spread_rad);
    if(count % 2 === 0) current_dir += (spread_rad / 2);

    const arr: ServerProjectileBullet[] = [];

    for(let i = 0; i < count; i++){
        const velocity = new Vec2(1,1).setDirection(current_dir).extend(initial_speed);

        const b = ServerShootProjectileWeapon(game, creator, position, velocity, shot_id, creator.playerEntity.mouse);

        arr.push(b);
        
        current_dir += spread_rad;
    }

    // if (true) {

    //     console.log(arr.map(b => b.velocity.toString()))

    // }

    return arr;
}

const fall_velocity = new Vec2(0,3.8);

export enum ItemEntityPhysicsMode {
    ASLEEP,
    FLOATING,
    BOUNCING,
}

//@ts-expect-error
@networkedclass_server("item_entity")
export class ItemEntity extends NetworkedEntity<"item_entity"> {


    override position: never;

    item: SBaseItem<keyof SharedNetworkedEntities>


    @sync("item_entity").var("art_path")
    art_path = ""

    // @sync("item_entity").var("item_id")
    // item_id = 0;

    @sync("item_entity").var("pos")
    pos = new Vec2(0,0)

    @sync("item_entity").var("initial_pos")
    initial_pos: Vec2 = new Vec2();

    mode: ItemEntityPhysicsMode = ItemEntityPhysicsMode.FLOATING;
    velocity = new Vec2();
        
    // 0 means it completely stops after bounce, 1 means no change in velocity
    private readonly slow_factor = 0.5;
    private readonly bouncing_gravity = new Vec2(0, .4);

    constructor(item: SBaseItem<keyof SharedNetworkedEntities>){
        super();
        this.item = item;
        this.art_path = item.GetStaticValue("item_sprite");
        //this.item_id = item.item_id;

        // this.mark_dirty("item_id");
        this.mark_dirty("initial_pos")
        this.mark_dirty("pos");
        this.mark_dirty("art_path");
    }

    update(dt: number): void {

        switch(this.mode){
            case ItemEntityPhysicsMode.ASLEEP: break;
            case ItemEntityPhysicsMode.FLOATING: {

                const col = this.game.terrain.lineCollision(this.pos, Vec2.add(this.pos, fall_velocity));
                if(col !== null){
                    this.pos.y = col.point.y - 15;
                    this.mode = ItemEntityPhysicsMode.ASLEEP;
                    // console.log("hit")
                } else {
                    this.pos.add(fall_velocity);
                    this.mark_dirty("pos");
                }

                break;
            }
            case ItemEntityPhysicsMode.BOUNCING: {
                this.mark_dirty("pos");
                const status = SimpleBouncePhysics(this.game.terrain,this.pos, this.velocity, this.bouncing_gravity, this.slow_factor);
                if(status.stopped) this.mode = ItemEntityPhysicsMode.ASLEEP;

                break;
            }
            default: AssertUnreachable(this.mode);
        }

        if(!this.game.active_scene.level_bbox.contains(this.pos)){
            this.game.destroyRemoteEntity(this);
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

    exploded = false;

    boom(){
        this.exploded = true;

        this.game.terrain.carveCircle(this.__position.x, this.__position.y, 45);
            
        this.game.enqueueGlobalPacket(
            new TerrainCarveCirclePacket(this.__position.x, this.__position.y, 45)
        );

        this.game.dmg_players_in_radius(this.__position, 50,20);
        
        this.game.callEntityEvent(this, "laser_tripmine", "boom");

        
        for(const entity of this.game.entities.entities){
            if(entity instanceof LaserTripmine_S){
                if(Vec2.distanceSquared(this.__position, entity.__position) < (45*2)**2){
                    if(!entity.exploded) entity.boom();
                }
            }
        }


        this.game.destroyRemoteEntity(this);
    }

    update(dt: number): void {

        for(const pEntity of this.game.active_scene.activePlayerEntities.values()){
            
            const p = Line.PointClosestToLine(this.line.A, this.line.B, pEntity.position);

            if(Vec2.distanceSquared(p,pEntity.position) < 20 * 20){
                this.boom();
            
                break;
            }
        } 
    }


}


//@ts-expect-error
@networkedclass_server("beam_weapon")
export class BeamWeapon_S extends SBaseItem<"beam_weapon"> {

}

export class BeamEffect_S extends ServerEntity {
    
    private static nextID = 0;
    static getNextID(){
        return this.nextID++;
    }

    direction = new Vec2(1,0);
    beam_id = 0;
    line = new Line(new Vec2(),new Vec2());

    constructor(public player: ServerPlayerEntity){
        super();
        this.beam_id = BeamEffect_S.getNextID();
    }

    update(dt: number): void {
        if(this.player.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.player.position);
            this.direction.set(this.player.look_dir).extend(1000);



            const end = Vec2.add(this.position, this.direction);

            this.line.A = this.position.clone();
            this.line.B = end;
            
            const terrain = this.game.terrain.lineCollision(this.position, end);
            if(terrain) this.line.B = terrain.point;

            // Check each players distance to the line.
            for(const pEntity of this.game.active_scene.activePlayerEntities.values()){
                if(pEntity.connectionID === this.player.connectionID) continue;

                if(this.line.pointDistance(pEntity.position) < 30){
                    pEntity.take_damage(.9);
                }
            } 

        }
    }

}





@networkedclass_server("ogre")
export class ServerOgre extends NetworkedEntity<"ogre"> {
    @sync("ogre").var("_x")
    _x = 1;

    @sync("ogre").var("asdasd")
    asdasd = 1;
    
    update(dt: number): void {

    }
}



//@ts-expect-error
@networkedclass_server("instance_death_laser")
export class InstantDeathLaser_S extends NetworkedEntity<"instance_death_laser"> {

    @sync("instance_death_laser").var("start")
    start = new Vec2()

    @sync("instance_death_laser").var("end")
    end = new Vec2()

    constructor(public line: Line){
        super();

        this.start.set(line.A);
        this.end.set(line.B);

        this.mark_dirty("start")
        this.mark_dirty("end")
    }

    update(dt: number): void {
        
        for(const p of this.game.active_scene.activePlayerEntities.values()){
            if(this.line.pointDistance(p.position) < 20){
                p.take_damage(100);
            }
        }
    }

}



/**** ITEM ACTION IMPLEMENTATIONS  ****/

@link_item_action_attempt("projectile_shot")
class ProjectileShotAttempt extends AttemptAction<"projectile_shot"> {
    
    attempt_action(x: number, y: number, dir_x: number, dir_y: number): void {
        console.log("Shot attempted!");

        const pos = new Vec2(x,y);
        const direction = new Vec2(dir_x, dir_y);

        if(this.player.playerEntity.item_in_hand instanceof SProjectileWeaponItem){
            const item = this.player.playerEntity.item_in_hand;

            if(item.ammo > 0){
                item.ammo -= 1;

                const shot_prefab_id = item.shot_id;

                const velocity = direction.extend(item.initial_speed);
    
                const b = ServerShootProjectileWeapon(this.game, this.player, pos, velocity, shot_prefab_id, this.player.playerEntity.mouse);

                this.respond_success("projectile_shot", x, y, velocity.x, velocity.y, shot_prefab_id, b.entityID);
                return;
            }
        }

        this.respond_fail("projectile_shot", ItemActionAck.INVALID_STATE);
    }
    
}



@link_item_action_attempt("shotgun_shot")
class ShotgunShotAttempt extends AttemptAction<"shotgun_shot"> {
    
    attempt_action(x: number, y: number): void {
        if(this.player.playerEntity.item_in_hand instanceof ShotgunWeapon_S){
            const item = this.player.playerEntity.item_in_hand;

            
            if(item.ammo > 0){
                item.ammo -= 1;

                const pos = new Vec2(x,y);

                // Get direction that player is looking
                const pEntity = this.player.playerEntity;
                const player_dir = Vec2.subtract(pEntity.mouse, pEntity.position);

                const bullets = ShootShotgunWeapon_S(this.game, this.player, item.item_id, item.shot_id, pos, player_dir)

                const vel = player_dir.clone().extend(item.initial_speed)

                const bullet_entity_id_list: number[] = bullets.map(b => b.entityID);
                this.respond_success("shotgun_shot", x, y, vel.x, vel.y, item.shot_id, item.item_id, bullet_entity_id_list)
                return;
                // this.enqueueGlobalPacket(
                //     new ActionDo_ShotgunShotPacket(clientID, createServerTick, pos, player_dir.clone().extend(item.initial_speed), item.shot_id, item.item_id, entity_id_list)
                // );

                // player_info.personalPackets.enqueue(
                //     new AcknowledgeItemAction_SHOTGUN_SHOT_SUCCESS_Packet(clientShotID, client_ids, entity_id_list)
                // );

            }
        }

        this.respond_fail("shotgun_shot", ItemActionAck.INVALID_STATE);
    }
    

}



@link_item_action_attempt("hitscan_shot")
class HitscanShotAttempt extends AttemptAction<"hitscan_shot"> {
    
    attempt_action(start_x: number, start_y: number, end_x: number, end_y: number): void {
        
        if(this.player.playerEntity.item_in_hand instanceof SHitscanWeapon){
            const item = this.player.playerEntity.item_in_hand;

            if(item.ammo > 0){
                item.ammo -= 1;

                const start = new Vec2(start_x, start_y);
                const end = new Vec2(end_x, end_y);

                const end_point = ServerShootHitscanWeapon(this.game, start, end, this.player.connectionID);
                this.respond_success("hitscan_shot",start_x, start_y, end_x, end_y, item.item_id);
                return;
            }
        }
        this.respond_fail("hitscan_shot", ItemActionAck.INVALID_STATE);
    }

}
