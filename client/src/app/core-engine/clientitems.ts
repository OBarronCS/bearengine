import { Sprite, Graphics } from "pixi.js";
import { Effect } from "shared/core/effects";
import { CreateItemData, GunItemData, ItemData, ItemType } from "shared/core/sharedlogic/items";
import { PacketWriter } from "shared/core/sharedlogic/networkschemas";
import { GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { CreateShootController, GunshootController } from "shared/core/sharedlogic/weapondefinitions";
import { BufferStreamWriter } from "shared/datastructures/bufferstream";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random_range } from "shared/misc/random";
import { Line } from "shared/shapes/line";
import { Vec2 } from "shared/shapes/vec2";
import { BearEngine, NetworkPlatformGame } from "./bearengine";
import { Entity } from "./entity";
import { SpritePart } from "./parts";

export function CreateClientItemFromType(item_data: ItemData){
    
    const type = item_data.item_type;

    switch(type){
        case ItemType.TERRAIN_CARVER: {
            return new TerrainCarverGun();
            break;
        }
        case ItemType.HITSCAN_WEAPON: {
            //@ts-expect-error
            return new Hitscan(item_data);
            break;
        }
        case ItemType.SIMPLE: {
            return new Item(item_data);
            break;
        }
        default: AssertUnreachable(type);
    }
}

export class Item<T extends ItemData> {
    item_data: T;

    constructor(item_data: T){
        this.item_data = item_data;
    }

    get item_type(){ return this.item_data.item_type; }
    get item_name(){ return this.item_data.item_name; }
    get item_id(){ return this.item_data.item_id; }
    get item_sprite(){ return this.item_data.item_sprite; }
}

// WEAPONS
export abstract class Gun<T extends GunItemData = GunItemData> extends Item<T> {

    readonly position = new Vec2();
    readonly direction = new Vec2();
    readonly shootController: GunshootController;

    constructor(item_data: T){
        super(item_data);
        this.shootController = CreateShootController(item_data.shoot_controller);
    }

    update(dt: number, position: Vec2, direction: Vec2, holdTrigger: boolean, game: NetworkPlatformGame): void {
        this.position.set(position);
        this.direction.set(direction);
        if(this.shootController.holdTrigger(holdTrigger)){
            if(this.item_data.ammo > 0){
                this.item_data.ammo -= 1;

                console.log()

                this.shoot(game);
            }
        }
    }

    protected abstract shoot(game: NetworkPlatformGame): void;
}


export function ShootHitscanWeapon(game: NetworkPlatformGame, line: Line): void {
    line.draw(game.engine.renderer.createCanvas(), 0xbeef00);
}

export class ServerBoundHitscanPacket extends PacketWriter {

    constructor(public createServerTick: number, public start: Vec2, public end: Vec2){
        super(false);
    }

    write(stream: BufferStreamWriter){
        stream.setUint8(ServerBoundPacket.SHOOT_WEAPON);
        stream.setUint8(ItemType.HITSCAN_WEAPON);

        stream.setFloat32(this.createServerTick);
        
        stream.setFloat32(this.start.x);
        stream.setFloat32(this.start.y);

        stream.setFloat32(this.end.x);
        stream.setFloat32(this.end.y);

    }
}

export class Hitscan extends Gun {

    shoot(game: NetworkPlatformGame): void {
        const ray = new Line(this.position, Vec2.add(this.position, this.direction.extend(1000)));

        ShootHitscanWeapon(game, ray);

        game.networksystem.queuePacket(
            new ServerBoundHitscanPacket(0,ray.A, ray.B)
        )

        // // Check in radius to see if any players are hurt
        // for(const client of game.clients){

        //     const p = game.players.get(client);

        //     if(ray.pointDistance(p.playerEntity.position) < 30){
        //         p.playerEntity.health -= 16;
        //     }
        // } 
    }

}

interface GunAddon {
    modifyShot: (bullet: ModularBullet) => void,
    [key: string]: any; // allow for random data
}

export class ModularGun<T extends GunItemData> extends Gun<T> {

    addons: GunAddon[] = [];

    constructor(data: T, addons: GunAddon[]){
        super(data);
        this.addons.push(...addons);
    }

    shoot(game: NetworkPlatformGame){
        const bullet = new ModularBullet();
            
        bullet.position.set(this.position);

        bullet.velocity.set(this.direction.clone().extend(25));


        for(const addon of this.addons){
            addon.modifyShot(bullet);
        }
    
        game.entities.addEntity(bullet);
    }
}

export class ModularBullet extends Effect<NetworkPlatformGame> {
    
    readonly velocity = new Vec2();
    private sprite = this.addPart(new SpritePart("test2.png"))

    constructor(){
        super();
    
        this.onUpdate(function(dt: number){
            this.position.add(this.velocity);
            console.log(this.position.x)
            if(!this.game.activeLevel.bbox.contains(this.position)){
                this.destroy();
            }
        });
    }
} 


export class TerrainHitAddon implements GunAddon {

    modifyShot(bullet: ModularBullet){
        bullet.onUpdate(function(){
            // const testTerrain = this.game.terrain.lineCollision(this.position,Vec2.add(this.position, this.velocity.clone().extend(100)));
            
            // const RADIUS = 40;
            // const DMG_RADIUS = 80;

            // if(testTerrain){
            //     this.game.terrain.carveCircle(testTerrain.point.x, testTerrain.point.y, RADIUS);

            //     this.game.enqueueGlobalPacket(
            //         new TerrainCarveCirclePacket(testTerrain.point.x, testTerrain.point.y, RADIUS)
            //     );

            //     const point = new Vec2(testTerrain.point.x,testTerrain.point.y);

            //     // Check in radius to see if any players are hurt
            //     for(const client of this.game.clients){
            //         const p = this.game.players.get(client);

            //         if(Vec2.distanceSquared(p.playerEntity.position,point) < DMG_RADIUS * DMG_RADIUS){
            //             p.playerEntity.health -= 16;
            //         }
            //     } 
                 
            //     this.destroy();
            // }
        })
    }
}

export class TerrainCarverGun extends ModularGun<GunItemData> {

    constructor(){
        super(
            CreateItemData("terrain_carver"),
            [
            new TerrainHitAddon(),
            {
                modifyShot(bullet){
                    bullet.onInterval(2, function(times){
                        this.velocity.drotate(random_range(-6,6))
                    })
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
        ])
    }
}





// Simple entity to draw an item as a sprite in the world
export class ItemDrawer extends Entity {
    image = this.addPart(new SpritePart(new Sprite()));

    constructor(){
        super();
        this.image.sprite.visible = false;
    }

    setItem(item: ItemData){
        this.setSprite(item.item_sprite);
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


