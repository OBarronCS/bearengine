import { Emitter } from "shared/graphics/particles";
import { Sprite, Graphics } from "shared/graphics/graphics";
import { Effect } from "shared/core/effects";
import { PacketWriter, SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController, ItemActionType, BulletEffects, PROJECTILE_SHOT_DATA, SHOT_LINKER } from "shared/core/sharedlogic/weapondefinitions";
import { NumberTween } from "shared/core/tween";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "./bearengine";
import { DrawableEntity, Entity } from "./entity";
import { PARTICLE_CONFIG } from "../../../../shared/core/sharedlogic/sharedparticles";
import { SpritePart } from "./parts";
import { net, networkedclass_client } from "./networking/cliententitydecorators";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";
import { AbstractEntity } from "shared/core/abstractentity";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { drawCircle, drawCircleOutline } from "shared/shapes/shapedrawing";
import { EmitterAttach } from "./particles";




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

    consumed: boolean = false;

    abstract operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame): boolean;

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

    override operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame): boolean {
        
        this.position.set(position);
        this.direction.set(Vec2.subtract(mouse, this.position).normalize()); 

        if(this.shootController.holdTrigger(mouse_down)){
            if(this.ammo > 0){
                this.ammo -= 1;

                this.shoot(game);
            }
        }

        return false;
    }

    protected abstract shoot(game: NetworkPlatformGame): void;

}

//@ts-expect-error
@networkedclass_client("projectile_weapon") //@ts-expect-error
export class ProjectileWeapon extends WeaponItem<"projectile_weapon"> {


    // private addons: GunAddon[] = TerrainCarverAddons;

    private readonly shot_name = this.GetStaticValue("shot_name");
    private readonly shot_id = SHOT_LINKER.NameToID(this.shot_name);

    
    private readonly bullet_effects = SHOT_LINKER.IDToData(this.shot_id).bullet_effects;
    

    protected shoot(game: NetworkPlatformGame): void {
        const dir = this.direction.normalize();
        
        const b = ShootProjectileWeapon(game, this.bullet_effects, this.position, dir.clone().extend(this.GetStaticValue("initial_speed")));

        game.entities.addEntity(b);

        const localID = game.networksystem.getLocalShotID();
        game.networksystem.localShotIDToEntity.set(localID,b)

        game.networksystem.enqueueStagePacket(
            new ServerBoundProjectileShotPacket(0, localID, this.position.clone(), dir)
        )
    }
}

export function ShootProjectileWeapon(game: NetworkPlatformGame, bullet_effects: BulletEffects[], position: Vec2, velocity: Vec2): ModularProjectileBullet {
    const bullet = new ModularProjectileBullet();

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

            default: AssertUnreachable(type);
        }
    }




    // for(const addon of addons){
    //     addon.modifyShot(bullet);
    // }

    return bullet
}


@networkedclass_client("projectile_bullet")
export class ModularProjectileBullet extends Effect<NetworkPlatformGame> {
    
    @net("projectile_bullet").variable("velocity")
    readonly velocity = new Vec2();


    private sprite = this.addPart(new SpritePart("bullet.png"));

    constructor(){
        super();

        this.onUpdate(function(dt: number){
            this.position.add(this.velocity);
        });

    }

    @net("projectile_bullet").event("changeTrajectory")
    _onChangeTrajectory(server_time: number, position: Vec2, velocity: Vec2){
        this.position.set(position);
        this.velocity.set(velocity);
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




//@ts-expect-error
@networkedclass_client("hitscan_weapon")
export class Hitscan extends WeaponItem {



    shoot(game: NetworkPlatformGame): void {
        const ray = new Line(this.position, Vec2.add(this.position, this.direction.extend(1000)));

        ShootHitscanWeapon(game, ray);

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

export function ShootHitscanWeapon(game: NetworkPlatformGame, line: Line): void {

    const canvas = game.engine.renderer.createCanvas();
    line.draw(canvas, 0x346eeb);
    const tween = new NumberTween(canvas, "alpha",.4).from(1).to(0).go().onFinish(() => canvas.destroy());

    game.entities.addEntity(tween);
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

    setItem(item: string){
        this.setSprite(item);
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
    
    operate(dt: number, position: Vec2, mouse: Vec2, mouse_down: boolean, game: NetworkPlatformGame): boolean {

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




