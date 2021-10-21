import { Emitter } from "shared/graphics/particles";
import { Sprite, Graphics } from "shared/graphics/graphics";
import { Effect } from "shared/core/effects";
import { PacketWriter, SharedNetworkedEntities } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController, ShotType } from "shared/core/sharedlogic/weapondefinitions";
import { NumberTween } from "shared/core/tween";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "./bearengine";
import { Entity } from "./entity";
import { PARTICLE_CONFIG } from "./particles";
import { SpritePart } from "./parts";
import { net, networkedclass_client } from "./networking/cliententitydecorators";
import { ITEM_LINKER, MIGRATED_ITEMS, Test } from "shared/core/sharedlogic/items";



// export class Item<T extends ItemData> {
//     item_data: T;

//     constructor(item_data: T){
//         this.item_data = item_data;
//     }

//     get item_type(){ return this.item_data.item_type; }
//     get item_name(){ return this.item_data.item_name; }
//     get item_id(){ return this.item_data.item_id; }
//     get item_sprite(){ return this.item_data.item_sprite; }
// }

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



//@ts-expect-error
@networkedclass_client("weapon_item")
export abstract class WeaponItem extends BaseItem<"weapon_item"> {

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

    handle(dt: number, position: Vec2, direction: Vec2, holdTrigger: boolean, game: NetworkPlatformGame): void {
        this.position.set(position);
        this.direction.set(direction);
        if(this.shootController.holdTrigger(holdTrigger)){
            if(this.ammo > 0){
                this.ammo -= 1;

                console.log()

                this.shoot(game);
            }
        }
    }

    protected abstract shoot(game: NetworkPlatformGame): void;

}

//@ts-expect-error
@networkedclass_client("terrain_carver_weapon")
export class TerrainCarverWeapon extends WeaponItem {

    private addons = TerrainCarverAddons

    protected shoot(game: NetworkPlatformGame): void {
        const velocity = this.direction.clone().extend(25);
        const b = ShootModularWeapon(game,this.addons,this.position,velocity);

        const localID = game.networksystem.getLocalShotID();
        game.networksystem.localShotIDToEntity.set(localID,b)

        game.networksystem.enqueueStagePacket(
            new ServerBoundTerrainCarverPacket(0, localID, this.position.clone(), velocity)
        )
    }
}

export class ServerBoundTerrainCarverPacket extends PacketWriter {

    constructor(public createServerTick: number, public localShotID: number, public start: Vec2, public velocity: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.REQUEST_SHOOT_WEAPON);
        stream.setUint8(ShotType.TERRAIN_CARVER);
        stream.setUint32(this.localShotID);

        stream.setFloat32(this.createServerTick);

        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.velocity.x);
        stream.setFloat32(this.velocity.y);

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
        stream.setUint8(ServerBoundPacket.REQUEST_SHOOT_WEAPON);
        stream.setUint8(ShotType.HIT_SCAN);

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
    modifyShot: (bullet: ModularBullet) => void,
    [key: string]: any; // allow for random data
}


export function ShootModularWeapon(game: NetworkPlatformGame, addons: GunAddon[], position: Vec2, velocity: Vec2): ModularBullet {
    const bullet = new ModularBullet();
            
    bullet.position.set(position);

    bullet.velocity.set(velocity);


    for(const addon of addons){
        addon.modifyShot(bullet);
    }

    game.entities.addEntity(bullet);

    return bullet;
}



// export class ModularGun<T extends GunItemData> extends Gun<T> {

//     addons: GunAddon[] = [];

//     constructor(data: T, addons: GunAddon[]){
//         super(data);
//         this.addons.push(...addons);
//     }

//     shoot(game: NetworkPlatformGame){
//         const velocity = this.direction.clone().extend(25);
//         const b = ShootModularWeapon(game,this.addons,this.position,velocity);

//         const localID = game.networksystem.getLocalShotID();
//         game.networksystem.localShotIDToEntity.set(localID,b)

//         game.networksystem.enqueueStagePacket(
//             new ServerBoundTerrainCarverPacket(0, localID, this.position.clone(), velocity)
//         )

//         // const bullet = new ModularBullet();
            
//         // bullet.position.set(this.position);

//         // bullet.velocity.set(this.direction.clone().extend(25));


//         // for(const addon of this.addons){
//         //     addon.modifyShot(bullet);
//         // }
    
//         // game.entities.addEntity(bullet);
//     }
// }

export class ModularBullet extends Effect<NetworkPlatformGame> {
    
    readonly velocity = new Vec2();
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




class TerrainHitAddon implements GunAddon {

    modifyShot(bullet: ModularBullet){
        bullet.onUpdate(function(){
            // Client side prediction of terrain hit?

            // const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
            
            // const RADIUS = 40;
            // const DMG_RADIUS = 80;

            // if(testTerrain){
            //     this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);
            //     this.destroy();
            // }
        })
    }
}

export const TerrainCarverAddons: GunAddon[] = [
    new TerrainHitAddon(),
    {
        modifyShot(bullet){
            // bullet.onInterval(2, function(times){
            //     this.velocity.drotate(random_range(-6,6))
            // })
        }
    },
    {
        gravity: new Vec2(0,.35),
        modifyShot(effect){

            const self = this;

            effect.onUpdate(function(){
                this.velocity.add(self.gravity);
            })
        }
    },
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
        this.image.sprite.texture = this.engine.getResource(path).texture;
    }


    update(dt: number): void {
    }

    draw(g: Graphics): void {

    }
}


