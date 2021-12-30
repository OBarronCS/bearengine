import { Emitter } from "shared/graphics/particles";
import { Sprite, Graphics, Text } from "shared/graphics/graphics";
import { Effect } from "shared/core/effects";
import { PacketWriter, SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController, ItemActionType, ProjectileBulletEffects, PROJECTILE_SHOT_DATA, SHOT_LINKER, BeamActionType, HitscanRayEffects } from "shared/core/sharedlogic/weapondefinitions";
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
import { AbstractEntity } from "shared/core/abstractentity";
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
import { dimensions } from "shared/shapes/rectangle";
import { SimpleBouncePhysics } from "shared/core/sharedlogic/sharedphysics"




class BaseItem<T extends keyof SharedNetworkedEntities> extends Entity {

    constructor(public item_id: number){
        super();
    }

    GetStaticValue(key: keyof Test<T>) {
        //@ts-expect-error
        return MIGRATED_ITEMS[ITEM_LINKER.IDToName(this.item_id)][key]
    }

    update(dt: number): void {}

}

export abstract class UsableItem<T extends keyof SharedNetworkedEntities> extends BaseItem<T> {

    // TEMP
    // juice = {knockback: 10, shake: .15};

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
                
                this.game.engine.camera.shake(.25);
                p.knockback(this.direction.clone().negate().extend(10))
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

    protected readonly shot_name = this.GetStaticValue("shot_name");
    protected readonly shot_id = SHOT_LINKER.NameToID(this.shot_name);

    
    protected readonly bullet_effects = SHOT_LINKER.IDToData(this.shot_id).bullet_effects;
    

    protected shoot(game: NetworkPlatformGame): void {
        const dir = this.direction.normalize();
        
        const b = ShootProjectileWeapon_C(game, SHOT_LINKER.IDToData(this.shot_id).bounce, this.bullet_effects, this.position, dir.clone().extend(this.GetStaticValue("initial_speed")), SHOT_LINKER.IDToData(this.shot_id).item_sprite);

        game.entities.addEntity(b);

        const localID = game.networksystem.getLocalShotID();
        game.networksystem.localShotIDToEntity.set(localID,b)

        game.networksystem.enqueueStagePacket(
            new ServerBoundProjectileShotPacket(0, localID, this.position.clone(), dir)
        )

        game.entities.addEntity(new EmitterAttach(b,"POOF","assets/particle.png"));
    }
}

//@ts-expect-error
@networkedclass_client("shotgun_weapon")
//@ts-expect-error 
export class ShotgunWeapon extends ProjectileWeapon<"shotgun_weapon"> {
    
    spread: number = this.GetStaticValue("spread");
    count: number = this.GetStaticValue("count")

    override shoot(game: NetworkPlatformGame): void {


        const local_id_list: number[] = [];

        const spread_rad = this.spread * DEG_TO_RAD;

            
        let current_dir = this.direction.angle() - (floor(this.count / 2)*spread_rad);
        if(this.count % 2 === 0) current_dir += (spread_rad / 2);

        for(let i = 0; i < this.count; i++){

            const dir = new Vec2(1,1).setDirection(current_dir).extend(this.GetStaticValue("initial_speed"));

            const b = ShootProjectileWeapon_C(game, SHOT_LINKER.IDToData(this.shot_id).bounce,this.bullet_effects, this.position, dir, SHOT_LINKER.IDToData(this.shot_id).item_sprite);


            console.log(b);

            game.entities.addEntity(b);
            game.entities.addEntity(new EmitterAttach(b,"POOF","assets/particle.png"));

            
            const localID = game.networksystem.getLocalShotID();
            game.networksystem.localShotIDToEntity.set(localID,b);

            local_id_list.push(localID);
            current_dir += spread_rad;
        }
    
        

        game.networksystem.enqueueStagePacket(
            new ServerBoundShotgunShotPacket(0, -1, this.position.clone(), local_id_list)
        )

        
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


export class ServerBoundProjectileShotPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2, public direction: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_ITEM_ACTION);
        stream.setUint8(ItemActionType.PROJECTILE_SHOT);
        stream.setUint32(this.localShotID);

        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.direction.x);
        stream.setFloat32(this.direction.y);
    }
}

export class ServerBoundShotgunShotPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2, public local_ids: number[]){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_ITEM_ACTION);
        stream.setUint8(ItemActionType.SHOTGUN_SHOT);
        stream.setUint32(this.localShotID);

        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        SerializeTypedArray(stream, netv.uint32(), this.local_ids);
    }
}




//@ts-expect-error
@networkedclass_client("hitscan_weapon")
//@ts-expect-error
export class HitscanWeapon_C extends WeaponItem<"hitscan_weapon"> {

    readonly hitscan_effects: HitscanRayEffects[] = this.GetStaticValue("hitscan_effects");

    shoot(game: NetworkPlatformGame): void {
        const ray = new Line(this.position, Vec2.add(this.position, this.direction.extend(1000)));

        ShootHitscanWeapon_C(game, ray, this.hitscan_effects);

        game.networksystem.enqueueStagePacket(
            new ServerBoundHitscanPacket(0,game.networksystem.getLocalShotID(), ray.A, ray.B)
        )
    }

}

export class ServerBoundHitscanPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2, public end: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_ITEM_ACTION);
        stream.setUint8(ItemActionType.HIT_SCAN);

        stream.setUint32(this.localShotID);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.end.x);
        stream.setFloat32(this.end.y);

    }
}

export function ShootHitscanWeapon_C(game: NetworkPlatformGame, line: Line, effects: HitscanRayEffects[]): void {

    const terrain = game.terrain.lineCollision(line.A, line.B);
    if(terrain) line.B = terrain.point;

    for(const effect of effects){
        const effect_type = effect.type;
        switch(effect_type){
            case "lightning": {
                const lines = CreateLightningLines(line.A, line.B);

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
                game.networksystem.enqueueStagePacket(
                    new ServerBoundBeamPacket(0,game.networksystem.getLocalShotID(), this.position, BeamActionType.START_BEAM)
                );      

                this.beam_effect = this.game.entities.addEntity(new LocalBeamEffect(player));
            }
        }
        if(this.active && !mouse_down){
            this.active = false;

            game.networksystem.enqueueStagePacket(
                new ServerBoundBeamPacket(0,game.networksystem.getLocalShotID(), this.position, BeamActionType.END_BEAM)
            );

            if(this.beam_effect){
                this.game.entities.destroyEntity(this.beam_effect);
                this.beam_effect = null;
            }
        }
              
        
        return false;
    }
}

export class ServerBoundBeamPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2, public action_type: BeamActionType){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_ITEM_ACTION);
        stream.setUint8(ItemActionType.BEAM);

        stream.setUint32(this.localShotID);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setUint8(this.action_type);
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
            game.networksystem.enqueueStagePacket(
                new ForceFieldItemActionPacket(0,this.game.networksystem.getLocalShotID(), this.position)
            );

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

export class ForceFieldItemActionPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_ITEM_ACTION);
        stream.setUint8(ItemActionType.FORCE_FIELD_ACTION);

        stream.setUint32(this.localShotID);
        
        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);
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

    override onDestroy(){
        this.game.engine.camera.shake(.2);
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
    bbox = this.addPart(new ColliderPart(dimensions(this.radius,this.radius), new Vec2(this.radius/2),"SlowZone"))
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



function CreateLightningLines(start_point: Coordinate, end_point: Coordinate, iterations: number = 5): Line[] {
    let lines = [];

    lines.push(new Line(start_point, end_point));
    
    // the longer the distance, the bigger this needs to be
    // so the lightning looks natural
    let offset =150;

   
    // how many times do we cut the segment in half?
    for (let i = 0; i < 5; i++) {

        const newLines: Line[] = [];

        for(const line of lines){
            const midPoint = mix(line.A, line.B, .5);
            
            midPoint.add(Line.normal(line.A, line.B).extend(random_range(-offset,offset)));

            newLines.push(new Line(line.A, midPoint))
            newLines.push(new Line(midPoint, line.B));

            /// sometimes, split!
            if(chance(18)){
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




