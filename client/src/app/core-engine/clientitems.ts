import { Emitter } from "shared/graphics/particles";
import { Sprite, Graphics } from "shared/graphics/graphics";
import { Effect } from "shared/core/effects";
import { PacketWriter, SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController, ItemActionType, OnProjectileHitTerrain, PROJECTILE_SHOT_DATA, SHOT_LINKER } from "shared/core/sharedlogic/weapondefinitions";
import { NumberTween } from "shared/core/tween";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "./bearengine";
import { Entity } from "./entity";
import { PARTICLE_CONFIG } from "../../../../shared/core/sharedlogic/sharedparticles";
import { SpritePart } from "./parts";
import { net, networkedclass_client } from "./networking/cliententitydecorators";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";




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

    
    private readonly on_terrain_effects = SHOT_LINKER.IDToData(this.shot_id).on_terrain;
    

    protected shoot(game: NetworkPlatformGame): void {
        const dir = this.direction.normalize();
        
        const b = ShootProjectileWeapon(game, this.on_terrain_effects, this.position, dir.clone().extend(this.GetStaticValue("initial_speed")));

        const localID = game.networksystem.getLocalShotID();
        game.networksystem.localShotIDToEntity.set(localID,b)

        game.networksystem.enqueueStagePacket(
            new ServerBoundProjectileShotPacket(0, localID, this.position.clone(), dir)
        )
    }
}

export function ShootProjectileWeapon(game: NetworkPlatformGame, on_terrain_hit_effects: OnProjectileHitTerrain[], position: Vec2, velocity: Vec2): ModularProjectileBullet {
    const bullet = new ModularProjectileBullet();

    bullet.position.set(position);

    bullet.velocity.set(velocity);


    for(const effect of on_terrain_hit_effects){
        
        const type = effect.type;

        switch(type){
            case "particle": {

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
                
                break;
            }

            default: AssertUnreachable(type);
        }
    }




    // for(const addon of addons){
    //     addon.modifyShot(bullet);
    // }

    game.entities.addEntity(bullet);

    return bullet
}


@networkedclass_client("projectile_bullet")
export class ModularProjectileBullet extends Effect<NetworkPlatformGame> {
    @net("projectile_bullet").variable("velocity")
    readonly velocity = new Vec2();

    @net("projectile_bullet").variable("pos")
    pos = new Vec2()

    private sprite = this.addPart(new SpritePart("test2.png"));

    private emitter: Emitter

    constructor(){
        super();

        this.onUpdate(function(dt: number){
            this.position.add(this.velocity);
            this.emitter.updateSpawnPos(this.x, this.y);
            if(!this.game.activeLevel.bbox.contains(this.position)){
                this.destroy();
            }
        });

        this.onStart(function(){
            this.emitter = this.engine.renderer.addEmitter("assets/particle.png", PARTICLE_CONFIG["ROCKET"], this.x, this.y)
        });

        this.onFinish(function(){
            this.emitter.emit = false;
        });
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




