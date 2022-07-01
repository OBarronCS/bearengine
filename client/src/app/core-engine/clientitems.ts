import { Emitter } from "shared/graphics/particles";
import { Sprite, Graphics, Text } from "shared/graphics/graphics";
import { Effect } from "shared/core/effects";
import { PacketWriter, SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController, ProjectileBulletEffects, PROJECTILE_SHOT_DATA, SHOT_LINKER, BeamActionType, HitscanRayEffects, ItemActionAck } from "shared/core/sharedlogic/weapondefinitions";
import { NumberTween } from "shared/core/tween";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { chance, random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Coordinate, mix, Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "./bearengine";
import { DrawableEntity, Entity } from "./entity";
import { PARTICLE_CONFIG } from "../../../../shared/core/sharedlogic/sharedparticles";
import { GraphicsPart, SpritePart } from "./parts";
import { net, networkedclass_client } from "./networking/cliententitydecorators";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { drawCircle, drawCircleOutline, drawLineArray, drawLineBetweenPoints } from "shared/shapes/shapedrawing";
import { EmitterAttach } from "./particles";
import { choose } from "shared/datastructures/arrayutils";
import { EMOJIS } from "./emojis";
import { Player, RemotePlayer } from "./../gamelogic/player"
import { netv, SerializeTypedArray } from "shared/core/sharedlogic/serialization";
import { DEG_TO_RAD, floor } from "shared/misc/mathutils";
import { TickTimer } from "shared/datastructures/ticktimer";
import { SlowAttribute } from "shared/core/sharedlogic/sharedattributes"
import { ColliderPart } from "shared/core/entitycollision";
import { dimensions, Rect } from "shared/shapes/rectangle";
import { SimpleBouncePhysics } from "shared/core/sharedlogic/sharedphysics"
import { RecoilShake, SmoothShake } from "./camera";
import { BoostDirection } from "../gamelogic/boostzone";
import { Polygon } from "shared/shapes/polygon";
import { register_clientside_itemaction, PredictAction } from "./networking/clientitemactionlinker";




class BaseItem<T extends keyof SharedNetworkedEntities> extends Entity {

    constructor(public item_id: number){
        super();
    }

    GetStaticValue<U extends keyof Test<T>>(key: U){
        //@ts-expect-error
        return MIGRATED_ITEMS[ITEM_LINKER.IDToName(this.item_id)][key]
    }

    update(dt: number): void {}

}

export abstract class UsableItem<T extends keyof SharedNetworkedEntities> extends BaseItem<T> {

    consumed: boolean = false;

    abstract operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame, player: Player): boolean;

}


//@ts-expect-error
@networkedclass_client("weapon_item")
export abstract class WeaponItem<T extends "weapon_item" = "weapon_item"> extends UsableItem<T> {

    readonly direction = new Vec2();
    readonly shootController: GunshootController = CreateShootController(this.GetStaticValue("shoot_controller"))

    @net("weapon_item").variable("ammo")
    ammo: number = this.GetStaticValue("ammo")

    @net("weapon_item").variable("capacity")
    capacity: number = this.GetStaticValue("capacity")

    @net("weapon_item").variable("reload_time")
    reload_time: number = this.GetStaticValue("reload_time")

    juice: Test<"weapon_item">["juice"] = this.GetStaticValue("juice");

    constructor(item_id: number){
        super(item_id);
        // this.shootController = CreateShootController(item_data.shoot_controller);
    }

    override operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame, p: Player): boolean {
        
        this.position.set(position);
        this.direction.set(Vec2.subtract(mouse, this.position).normalize()); 

        if(this.shootController.holdTrigger(mouse_down)){
            if(this.ammo > 0){
                this.ammo -= 1;

                this.shoot(game);
                
                if(this.juice.shake.type === "normal"){
                    this.game.engine.camera.addShake(new RecoilShake(this.direction.clone().negate()))
                }
                
                p.knockback(this.direction.clone().negate().extend(this.juice.knockback));
            }
        }

        return false;
    }

    protected abstract shoot(game: NetworkPlatformGame): void;

}

//@ts-expect-error
@networkedclass_client("projectile_weapon") //@ts-expect-error
export class ProjectileWeapon<T extends "projectile_weapon" = "projectile_weapon"> extends WeaponItem<T> {


    // private addons: GunAddon[] = TerrainCarverAddons;

    readonly shot_name = this.GetStaticValue("shot_name");
    readonly shot_id = SHOT_LINKER.NameToID(this.shot_name);

    
    readonly bullet_effects = SHOT_LINKER.IDToData(this.shot_id).bullet_effects;
    

    protected shoot(game: NetworkPlatformGame): void {

        const a = new PredictProjectileShot(this.game, this);
        a.predict_action();

    }
}

//@ts-expect-error
@networkedclass_client("shotgun_weapon")
//@ts-expect-error 
export class ShotgunWeapon extends ProjectileWeapon<"shotgun_weapon"> {
    
    // spread: number = this.GetStaticValue("spread");
    // count: number = this.GetStaticValue("count")

    override shoot(game: NetworkPlatformGame): void {

        const a = new PredictShotgunShot(this.game, this);
        a.predict_action();
        
    }
}

/** Does not insert the bullet into a scene. Just returns the entity */
export function ShootProjectileWeapon_C(game: NetworkPlatformGame, bounce: boolean, bullet_effects: ProjectileBulletEffects[], position: Vec2, velocity: Vec2, sprite_path: string): ModularProjectileBullet {
    const bullet = new ModularProjectileBullet(bounce);

    bullet.position.set(position);
    bullet.velocity.set(velocity);


    for(const effect of bullet_effects){
        
        const type = effect.type;

        switch(type){
            case "particle_system": {
                const particle_path = effect.particle as keyof typeof PARTICLE_CONFIG;

                const particle_system = new EmitterAttach(bullet,particle_path,"assets/particle.png");

                bullet.onStart(function(){
                    game.entities.addEntity(particle_system);
                });

                break;
            }
            case "gravity": {

                const grav = new Vec2().set(effect.force);

                bullet.onUpdate(function(){
                    this.velocity.add(grav);
                });

                break;
            }
            case "goto_mouse": {

                break;
            }
            case "destroy_after":{
                break;
            }

            case "terrain_hit_boom": {
                
                break;
            }
            case "laser_mine_on_hit": {
                
                break;
            }
            case "emoji": {
                
                const text = new Text(choose(EMOJIS));

                bullet.onStart(function(){
                    //this.sprite.visible = false;
                    this.sprite.sprite.addChild(text);
                });

                bullet.onUpdate(function(){
                    text.angle = this.velocity.dangle()
                });

                bullet.onFinish(function(){
                    this.game.engine.renderer.addEmitter("particle.png", PARTICLE_CONFIG.EMOJI_HIT_WALL, this.x, this.y)
                });

                break;
            }
            case "ice_slow": {

                bullet.onFinish(function(){
                
                    const effect = new LocalIceEffect(2.6);
                    effect.position.set(this.position);
                    // console.log("ICE: "+this.position);
                    game.entities.addEntity(effect);

                });

                break;
            }
            case "paint_ball":{

                bullet.onFinish(function(){


                    // const hit = this.game.terrain.get_terrain_intersection(new Rect(this.x - 5, this.y - 5, 10, 10));

                    // const points: Vec2[] = [];

                    // for(const h of hit){
                    //     const p = h.polygon.closestPoint(this.position);
                    //     points.push(p);
                    // }

                    // const g = this.game.engine.renderer.createCanvas();
                    // Polygon.from(points).draw(g);
                });
                
                break;
            }

            default: AssertUnreachable(type);
        }
    }


    bullet.sprite.file_path = sprite_path;
    bullet.sprite.sprite.anchor.set(.5, .5);

    // for(const addon of addons){
    //     addon.modifyShot(bullet);
    // }

    return bullet
}

// Bullets are special, don't follow normal shared entity rules, are not created normally
//@ts-expect-error
@networkedclass_client("projectile_bullet")
export class ModularProjectileBullet extends Effect<NetworkPlatformGame> {
    
    @net("projectile_bullet").variable("velocity")
    readonly velocity = new Vec2();

    readonly sprite = this.addPart(new SpritePart("bullet.png"));

    continue_moving = true;

    constructor(public bounce: boolean){
        super();

        this.onUpdate(function(dt: number){
            if(this.continue_moving){

                const zones = this.game.collisionManager.point_query_list(this.position, BoostDirection);
                for(const z of zones){
                    this.velocity.add(z.attr.dir);
                }

                if(this.bounce){
                    SimpleBouncePhysics(this.game.terrain, this.position, this.velocity, new Vec2(0, .4), .6);
                } else {
                    this.position.add(this.velocity);
                }
                this.sprite.angle = this.velocity.angle();
            }
        });

    }

    @net("projectile_bullet").event("changeTrajectory")
    _onChangeTrajectory(server_time: number, position: Vec2, velocity: Vec2){
        this.position.set(position);
        this.velocity.set(velocity);
    }

    @net("projectile_bullet").event("finalPosition")
    _finalPosition(pos: Vec2, ticks: number){
        this.continue_moving = false;
        this.position.set(pos);
    }

}


/* Applies spread, ect; Returns a list of all the created bullets. Does not add to the scene yet */
export function ShootShotgunWeapon_C(game: NetworkPlatformGame, shotgun_id: number, shot_id: number, position: Vec2, direction: Vec2): ModularProjectileBullet[] {
    const bullet_data = SHOT_LINKER.IDToData(shot_id);
    const bullet_effects = bullet_data.bullet_effects;
    const does_bounce = bullet_data.bounce;


    const shotgun_data = ITEM_LINKER.IDToData(shotgun_id) as Test<"shotgun_weapon">;
    const initial_speed = shotgun_data.initial_speed;
    const count = shotgun_data.count;
    const spread_rad = shotgun_data.spread * DEG_TO_RAD;

    let current_dir = direction.angle() - (floor(count / 2)*spread_rad);
    if(count % 2 === 0) current_dir += (spread_rad / 2);

    const arr: ModularProjectileBullet[] = [];

    for(let i = 0; i < count; i++){

        const velocity = new Vec2(1,1).setDirection(current_dir).extend(initial_speed);

        const b = ShootProjectileWeapon_C(game, does_bounce, bullet_effects, position, velocity, bullet_data.item_sprite);

        arr.push(b);

        current_dir += spread_rad;
    }
    

    // console.log(arr.map(b => b.velocity.toString()))

    return arr;

}



//@ts-expect-error
@networkedclass_client("hitscan_weapon")
//@ts-expect-error
export class HitscanWeapon_C extends WeaponItem<"hitscan_weapon"> {

    readonly hitscan_effects: HitscanRayEffects[] = this.GetStaticValue("hitscan_effects");

    shoot(game: NetworkPlatformGame): void {
        const a = new PredictHitscanShot(this.game, this);
        a.predict_action();
    }

}

export function ShootHitscanWeapon_C(game: NetworkPlatformGame, line: Line, effects: HitscanRayEffects[]): void {

    const terrain = game.terrain.lineCollision(line.A, line.B);
    if(terrain) line.B = terrain.point;

    for(const effect of effects){
        const effect_type = effect.type;
        switch(effect_type){
            case "lightning": {
                const lines = CreateLightningLines(line.A, line.B, 73);

                const canvas = game.engine.renderer.createCanvas();
                for(const line of lines){
                    line.draw(canvas,0xFFFFFF);
                }
                
                const tween = new NumberTween(canvas, "alpha",.4).from(1).to(0).go().onFinish(() => canvas.destroy());
            
                game.entities.addEntity(tween);
                game.engine.renderer.addEmitter("particle.png", PARTICLE_CONFIG.BULLET_HIT_WALL, line.B.x, line.B.y);

                break;
            }
            default: AssertUnreachable(effect_type);
        }
    }
    
    if(effects.length === 0){
        const canvas = game.engine.renderer.createCanvas();
        line.draw(canvas, 0x346eeb);
        const tween = new NumberTween(canvas, "alpha",.4).from(1).to(0).go().onFinish(() => canvas.destroy());
    
        game.entities.addEntity(tween);
        game.engine.renderer.addEmitter("particle.png", PARTICLE_CONFIG.BULLET_HIT_WALL, line.B.x, line.B.y);
    }

}

//@ts-expect-error
@networkedclass_client("beam_weapon")
export class BeamWeapon extends UsableItem<"beam_weapon"> {
    
    active = false;

    beam_effect: LocalBeamEffect = null;

    operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame, player: Player): boolean {
        if(!this.active){
            if(mouse_down) {
                this.active = true;

                const a = new PredictBeamAction(this.game, this);
                a.predict_action(); 

                this.beam_effect = this.game.temp_level_subset.addEntity(new LocalBeamEffect(player));
            }
        }

        if(this.active && !mouse_down){
            this.active = false;


            const a = new PredictBeamAction(this.game, this);
            a.predict_action();


            if(this.beam_effect){
                this.game.temp_level_subset.destroyEntity(this.beam_effect);
                this.beam_effect = null;
            }
        }
              
        
        return false;
    }
}


interface GunAddon {
    modifyShot: (bullet: ModularProjectileBullet) => void,
    [key: string]: any; // allow for random data
}


class TerrainHitAddon implements GunAddon {

    modifyShot(bullet: ModularProjectileBullet){
        bullet.onUpdate(function(){
            // Client side prediction of terrain hit?

            // const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
            // const RADIUS = 40;

            // if(testTerrain){
            //     this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);
            //     this.destroy();
            // }
        })
    }
}

export const TerrainCarverAddons: GunAddon[] = [
    new TerrainHitAddon(),
]



// Simple entity to draw an item as a sprite in the world
export class ItemDrawer extends Entity {
    image = this.addPart(new SpritePart(new Sprite()));

    constructor(){
        super();
        this.image.sprite.visible = false;
    }

    setItem(path: string){
        this.setSprite(path);
    }

    clear(){
        this.image.sprite.visible = false;
    }

    private setSprite(path: string){
        this.image.sprite.visible = true;
        this.image.sprite.texture = this.engine.renderer.getTexture(path);
    }


    update(dt: number): void {
    }

    draw(g: Graphics): void {

    }
}





//@ts-expect-error
@networkedclass_client("forcefield_item")
export class ForceFieldItem_C extends UsableItem<"forcefield_item"> {
    
    radius = this.GetStaticValue("radius")
    
    operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame, p: Player): boolean {

        if(mouse_down){


            // game.networksystem.enqueueStagePacket(
            //     new ForceFieldItemActionPacket(0,this.game.networksystem.getLocalShotID(), this.position)
            // );

            const a = new PredictForceFieldAction(this.game, this);
            a.predict_action();

            return true;
        }

        return false;
    }
}



@networkedclass_client("forcefield_effect")
export class ForceFieldEffect_C extends DrawableEntity {

    target_player: AbstractEntity = null;

    @net("forcefield_effect").variable("player_id", function(this:ForceFieldEffect_C, id){ 
        
        if(this.game.networksystem.MY_CLIENT_ID === id){
            this.target_player = this.game.player;
        } else {
            const p = this.game.networksystem["remotePlayerEntities"].get(id);
            this.target_player = p;
        }
    })
    player_id: number

    @net("forcefield_effect").variable("radius")
    radius: number

    update(dt: number): void {

        if(this.target_player !== null && this.target_player.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.target_player);
            this.redraw(true);
        } else {
            this.destroy();
        }
    }

    draw(g: Graphics): void {
        drawCircleOutline(g, this.position, this.radius);
    }

}



@networkedclass_client("laser_tripmine")
export class LaserTripmine_C extends DrawableEntity {

    @net("laser_tripmine").variable("__position", function(this:LaserTripmine_C, id){ 
        this.redraw(true)
    })
    __position = new Vec2();

    @net("laser_tripmine").variable("direction", function(this:LaserTripmine_C, id){ 
        this.redraw(true)
    })
    direction = new Vec2();

    update(dt: number): void {
   
    }

    draw(g: Graphics): void {
        drawLineBetweenPoints(g, this.__position, Vec2.add(this.__position, this.direction.clone().extend(30)))
        drawCircleOutline(g, this.__position, 30);
    }

    @net("laser_tripmine").event("boom")
    onBoom(){
        this.game.engine.camera.addShake(new SmoothShake(.8));
    }
}


@networkedclass_client("swap_item")
export class PlayerSwapItem_C extends Entity {
    update(dt: number): void {}
}


export class BeamEffect_C extends DrawableEntity {

    direction = new Vec2(1,0);
    line = new Line(new Vec2(), new Vec2());

    constructor(public player: RemotePlayer){
        super();
        
    }

    update(dt: number): void {
        if(this.player.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.player.position);
            this.direction.set(this.player.look_angle.value).extend(1000);

            const end = Vec2.add(this.position, this.direction);

            this.line.A = this.position.clone();
            this.line.B = end;
            
            const terrain = this.game.terrain.lineCollision(this.position, end);
            if(terrain) this.line.B = terrain.point;


            this.redraw(true);
            

        }
    }

    draw(g: Graphics): void {
        
        this.line.draw(g, 0x346eeb, 7);
        
        
        this.game.engine.renderer.addEmitter("particle.png", PARTICLE_CONFIG.BULLET_HIT_WALL, this.line.B.x, this.line.B.y);
    }
    
}


class LocalBeamEffect extends DrawableEntity {
    direction = new Vec2(1,0);
    line = new Line(new Vec2(), new Vec2());

    constructor(public player: Player){
        super();
        
    }

    update(dt: number): void {
        if(this.player.entityID !== NULL_ENTITY_INDEX){
            this.position.set(this.player.position);
            this.direction.set(Vec2.subtract(this.mouse, this.player.position).extend(1000));

            const end = Vec2.add(this.position, this.direction);

            this.line.A = this.position.clone();
            this.line.B = end;
            
            const terrain = this.game.terrain.lineCollision(this.position, end);
            if(terrain) this.line.B = terrain.point;


            this.redraw(true);
            

        }
    }

    draw(g: Graphics): void {
        
        this.line.draw(g, 0x346eeb, 7);
        
        
        this.game.engine.renderer.addEmitter("particle.png", PARTICLE_CONFIG.BULLET_HIT_WALL, this.line.B.x, this.line.B.y);
    }
}



class LocalIceEffect extends DrawableEntity {
    
    
    readonly radius = 100;
    bbox = this.addPart(new ColliderPart(dimensions(this.radius,this.radius), new Vec2(this.radius/2)))
    slow_attribute: SlowAttribute

    private seconds_alive = 0;

    constructor(public lifetime_s: number){
        super();

        this.slow_attribute = this.addPart(new SlowAttribute(this.radius, 5))
    }

    override onAdd(): void {
        const canvas = this.game.engine.renderer.createCanvas();
        drawCircle(canvas, this.position, this.radius, 0x346eeb);
        const tween = new NumberTween(canvas, "alpha",this.lifetime_s + .2).from(1).to(0).go().onFinish(() => canvas.destroy());

        this.game.entities.addEntity(tween)
    }

    update(dt: number): void {
        this.seconds_alive += dt;
        if(this.seconds_alive > this.lifetime_s){
            this.destroy();
        }
    }

    draw(g: Graphics): void {

    }


}



function CreateLightningLines(start_point: Coordinate, end_point: Coordinate, offset: number = 150, iterations: number = 5): Line[] {
    let lines: Line[] = [];

    lines.push(new Line(start_point, end_point));
    
    // the longer the distance, the bigger this needs to be
    // so the lightning looks natural
   
    // how many times do we cut the segment in half?
    for (let i = 0; i < 5; i++) {

        const newLines: Line[] = [];

        for(const line of lines){
            const midPoint = mix(line.A, line.B, .5);
            
            midPoint.add(Line.normal(line.A, line.B).extend(random_range(-offset,offset)));

            newLines.push(new Line(line.A, midPoint))
            newLines.push(new Line(midPoint, line.B));

            /// sometimes, split!
            if(chance(.18)){
                const dir = Vec2.subtract(midPoint, line.A);
                dir.drotate(random_range(-30,30)).scale(.7).add(midPoint);
                newLines.push(new Line(midPoint, dir));
            }
        }

        lines = newLines;
        offset /= 2;
    }

    return lines;
}




class LightningTest extends DrawableEntity {

    private startPoint = Vec2.ZERO;

    private lines: Line[] = [];

    private ticker = new TickTimer(6);

    update(dt: number): void {
        if(!this.ticker.tick()) return;
        this.lines = [];
        if(this.mouse.wasPressed("left")){
            this.startPoint = this.mouse.position.clone();
        }
        const mousePoint = this.mouse.position.clone();

        this.lines = CreateLightningLines(this.startPoint, mousePoint);

        this.redraw();
    }


    draw(g: Graphics): void {
        g.clear();
        for(const line of this.lines){
            line.draw(g,0xFFFFFF);
        }
    }

}


////@ts-expect-error
@networkedclass_client("instance_death_laser")
export class InstantDeathLaser_C extends DrawableEntity {

    @net("instance_death_laser").variable("start")
    start = new Vec2()

    @net("instance_death_laser").variable("end")
    end = new Vec2()

    constructor(){
        super();
    }

    update(dt: number): void {
        this.redraw();
    }

    draw(g: Graphics): void {
        drawLineBetweenPoints(g, this.start, this.end, 0xFF0000, 1, 14)
    }

}




// ACTIONS
register_clientside_itemaction("projectile_shot", 
    (creator_id,game: NetworkPlatformGame, x, y, dir_x: number, dir_y: number, shot_prefab_id: number, bullet_entity_id: number) => {

        console.log("Someone else shot a weapon!")

        const pos = new Vec2(x,y);
        const velocity = new Vec2(dir_x, dir_y);

        const bullet_effects = SHOT_LINKER.IDToData(shot_prefab_id).bullet_effects;
        const sprite = SHOT_LINKER.IDToData(shot_prefab_id).item_sprite;

        // Creates bullet, links it to make it a shared entity
        const b = ShootProjectileWeapon_C(game, SHOT_LINKER.IDToData(shot_prefab_id).bounce, bullet_effects, pos, velocity, sprite);

        // It's now a networked entity
        //@ts-expect-error
        game.networksystem.remoteEntities.set(bullet_entity_id, b);
        game.networksystem.networked_entity_subset.addEntity(b);

});


class PredictProjectileShot extends PredictAction<"projectile_shot", ProjectileWeapon> {
    
    private predicted_bullet_id: EntityID;

    predict_action(): void {
        const dir = this.state.direction.normalize();
        this.request_action("projectile_shot", this.state.x, this.state.y, dir.x, dir.y);
    
        // if(predict)
        // Predict bullet shot
        const b = ShootProjectileWeapon_C(this.game, SHOT_LINKER.IDToData(this.state.shot_id).bounce, this.state.bullet_effects, this.state.position, dir.clone().extend(this.state.GetStaticValue("initial_speed")), SHOT_LINKER.IDToData(this.state.shot_id).item_sprite);
        
        this.game.entities.addEntity(b);

        this.predicted_bullet_id = b.entityID

        this.game.entities.addEntity(new EmitterAttach(b,"POOF","assets/particle.png"));
    }

    ack_success(x: number, y: number, dir_x: number, dir_y: number, shot_prefab_id: number, bullet_entity_id: number): void {

        console.log("Success");
        const bullet = this.game.entities.getEntity<ModularProjectileBullet>(this.predicted_bullet_id);
                        
        // Allows bullet to be controlled remotely
        if(bullet !== undefined){
            //@ts-expect-error
            this.game.networksystem.remoteEntities.set(bullet_entity_id, bullet);
            this.game.networksystem.networked_entity_subset.forceAddEntityFromMain(bullet);
        }

    }

    ack_fail(error_code: ItemActionAck): void {
        console.log("FAILED TO FIRE WEAPON")
    }
}



register_clientside_itemaction("shotgun_shot", 
    (creator_id, game: NetworkPlatformGame, x: number, y: number, vel_x: number, vel_y: number, shot_prefab_id: number, shotgun_prefab_id: number, bullet_entity_id_list: number[]) => {
        console.log("Shotgun being shot!");

        const pos = new Vec2(x,y);
        const velocity = new Vec2(vel_x, vel_y);
        
        const bullets = ShootShotgunWeapon_C(game, shotgun_prefab_id, shot_prefab_id, pos, velocity);

        if(bullet_entity_id_list.length !== bullets.length) throw new Error("Client created different number of bullets in shotgun shot than server");

        for(let i = 0; i < bullet_entity_id_list.length; i++) {
            const remote_id = bullet_entity_id_list[i];

            //@ts-expect-error
            game.networksystem.remoteEntities.set(remote_id, bullets[i]);
            game.networksystem.networked_entity_subset.addEntity(bullets[i]);
        }
        
    }
);



class PredictShotgunShot extends PredictAction<"shotgun_shot", ShotgunWeapon> {
    
    private predicted_bullet_id_list: EntityID[] = [];
    
    predict_action(): void {
        console.log("Request shotgun shot");
        
        const bullets = ShootShotgunWeapon_C(this.game, this.state.item_id, this.state.shot_id, this.state.position, this.state.direction)
        

        for(const b of bullets){

            this.game.entities.addEntity(b);
            this.game.entities.addEntity(new EmitterAttach(b,"POOF","assets/particle.png"));

            this.predicted_bullet_id_list.push(b.entityID);

        }
    
        this.request_action("shotgun_shot", this.state.x, this.state.y);
    }

    ack_success(x: number, y: number, vel_x: number, vel_y: number, shot_prefab_id: number, shotgun_prefab_id: number, bullet_entity_id_list: number[]): void {
        console.log("Success in shotgun shot!");

        if(bullet_entity_id_list.length !== this.predicted_bullet_id_list.length) throw new Error("Client created different number of bullets in shotgun shot than server");

        for(let i = 0; i < this.predicted_bullet_id_list.length; i++){
            const local_id = this.predicted_bullet_id_list[i];
            const remote_id = bullet_entity_id_list[i];

            // Is an effect
            const bullet = this.game.entities.getEntity<ModularProjectileBullet>(local_id);
                                                    
            // May not exist, for some reason...
            if(bullet !== undefined){
                if(bullet.entityID !== NULL_ENTITY_INDEX){

                    //@ts-expect-error
                    this.game.networksystem.remoteEntities.set(remote_id, bullet);
                    this.game.networksystem.networked_entity_subset.forceAddEntityFromMain(bullet);

                } else {

                }
            }
        }

    }

    ack_fail(error_code: ItemActionAck): void {
        console.log("Failed shotgun shot");


    }

}



register_clientside_itemaction("hitscan_shot", 
    (creator_id, game: NetworkPlatformGame, start_x: number, start_y: number, end_x: number, end_y: number, weapon_prefab_id: number) => {
        
        console.log('HITSCANS')
        const start = new Vec2(start_x, start_y);
        const end = new Vec2(end_x, end_y);

        const ray = new Line(start, end);

        //@ts-expect-error
        const effects: HitscanRayEffects[] = ITEM_LINKER.IDToData(weapon_prefab_id).hitscan_effects;

        ShootHitscanWeapon_C(game, ray, effects);
})


class PredictHitscanShot extends PredictAction<"hitscan_shot", HitscanWeapon_C> {
    
    predict_action(): void {
        const ray = new Line(this.state.position, Vec2.add(this.state.position, this.state.direction.extend(1000)));

        ShootHitscanWeapon_C(this.game, ray, this.state.hitscan_effects);

        this.request_action("hitscan_shot", ray.A.x, ray.A.y, ray.B.x, ray.B.y);
    }

    ack_success(start_x: number, start_y: number, end_x: number, end_y: number, weapon_prefab_id: number): void {
        console.log("hitscan_success")
    }

    ack_fail(error_code: ItemActionAck): void {
        console.log("Hitscan failed")
    }

}


/** Never gets called, but necessary for linker */
register_clientside_itemaction("force_field", (game) => {

});

class PredictForceFieldAction extends PredictAction<"force_field", {}> {
    
    predict_action(): void {
        this.request_action("force_field");
    }

    ack_success(): void {
        console.log("Success shield");
    }
    ack_fail(error_code: ItemActionAck): void {
        console.log("Failed shield");
    }

}



/** Never gets called, but necessary for linker */
register_clientside_itemaction("beam", (creator_id, game, beam_action_type: BeamActionType, beam_id) => {
    switch(beam_action_type){
        case BeamActionType.START_BEAM:{
            console.log("Start beam");
            const beam = new BeamEffect_C(game.networksystem.remotePlayerEntities.get(creator_id));
            
            game.networksystem.beamIDToEntity.set(beam_id,beam);
            game.temp_level_subset.addEntity(beam);

            break;
        }
        case BeamActionType.END_BEAM:{
            console.log("End beam");
            const get = game.networksystem.beamIDToEntity.get(beam_id);
            if(get){
                game.temp_level_subset.destroyEntity(get);
                game.networksystem.beamIDToEntity.delete(beam_id);
            }
        
            break;
        }
        default: AssertUnreachable(beam_action_type);
    }
});


class PredictBeamAction extends PredictAction<"beam", BeamWeapon> {
    
    predict_action(): void {
        this.request_action("beam", <never>(this.state.active ? BeamActionType.START_BEAM : BeamActionType.END_BEAM));
    }

    ack_success(): void {
        console.log("Success beam");
    }
    ack_fail(error_code: ItemActionAck): void {
        console.log("Failed beam");
    }

}








