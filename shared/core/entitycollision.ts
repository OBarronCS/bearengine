
/*
Two uses:
    Deals with potential collision between entities
    Collision querys to find entities that lie under some query (line, box, circle)

    Some entities are moving, some stay in place, many only live for a couple seconds. 

Only for collision detection for AABB's. No resolution.
*/

import type { Graphics } from "shared/graphics/graphics";
import { Line } from "shared/shapes/line";
import { Dimension, Rect } from "shared/shapes/rectangle";
import { SpatialGrid } from "shared/datastructures/spatialgrid";
import { AbstractEntity } from "shared/core/abstractentity";
import { Subsystem } from "./subsystem";
import { Attribute, get_attribute_id, get_attribute_id_from_type } from "./entityattribute";
import { Vec2, Coordinate } from "shared/shapes/vec2";
import { CustomEventDispatcher } from "./bearevents";
import { SparseSet } from "shared/datastructures/sparseset";


/**
 * Tags are used to identify entities in collisions
 *  Collider parts are given a tag name.
 */
// Help to identify certain entities, like in collision

export const DEFAULT_TAG = "Unnamed";

const tags = [
    DEFAULT_TAG,
    "Player",
    "BoostZone",
    "SlowZone"
] as const;

export type TagName = typeof tags[number]

export class ColliderPart extends Attribute {

    public readonly tag: TagName;
    public readonly rect: Rect; // bbox
    /* Where on the rectangle is the position */
    public readonly offset: Vec2;

    public check_collisions = false;


    readonly active_callbacks = new Map<number,((attr: Attribute) => void)>();
    // isTrigger

    constructor(dimensions: Dimension, offset: Coordinate, name: TagName = DEFAULT_TAG){
        super();
        this.rect = new Rect(0,0,dimensions.width, dimensions.height);
        this.offset = new Vec2(-offset.x,-offset.y);
        this.tag = name;
    }

    setPosition(spot: Coordinate){
        this.rect.moveTo(spot);
        this.rect.translate(this.offset);
    }
}


// interface CollisionData {
//     entity: AbstractEntity,
//     collider: ColliderPart
// }


export class CollisionManager extends Subsystem {
    
    init(): void {}

    // With lots of entities, this will probably become a bottleneck, because it rebuilds the grid every step, but it works fine for now
    private grid: SpatialGrid<ColliderPart> = new SpatialGrid(1,1,1,1,(collider) => collider.rect);

    public colliders = this.addQuery(ColliderPart,
        e => this.grid.insert(e),
    );



    private readonly active_collisions = this.addEventDispatcher(new CustomEventDispatcher("collision", 
        (sparse_index: number, entity: AbstractEntity, method_name: string, other_type: typeof Attribute) => {
            console.log("Collision for " + entity.constructor.name + " registered")
            const collider = entity.getAttribute(ColliderPart);
            if(collider == null){
                console.error("Cannot find collider part for entity: " + entity.constructor.name)
                return;
            }

            if(get_attribute_id_from_type(other_type) === -1) this.game.entities["register_new_attribute_type"](other_type);

            collider.active_callbacks.set(get_attribute_id_from_type(other_type), (attr: Attribute) => {
                entity[method_name](attr);
            });

            collider.check_collisions = true;
        },
        (sparse_index: number) => {
            console.error("IMPLEMENT THIS");
        }
    ));


    setupGrid(worldWidth: number, worldHeight: number){
        this.grid = new SpatialGrid<ColliderPart>(worldWidth,worldHeight,6,6,(collider) => collider.rect);
    }

    update(dt: number): void {
        
        this.grid.clear();

        // Re-insert, re-position
        for(const collider of this.colliders){
            collider.setPosition(collider.owner.position);
            this.grid.insert(collider);
        }

        for(const collider of this.colliders){
            if(collider.check_collisions){
                // Get list of all other colliders that collide with this one
                for(const other of this.collision_list(collider)){
                    // Check if it matches any of the registered callbacks

                    for(const val of collider.active_callbacks.keys()){
                        if(this.game.entities.hasAttributeByID(other.owner.entityID,val)){

                            collider.active_callbacks.get(val)(this.game.entities.getAttributeByID(other.owner.entityID, val));
                        }
                    }

                }
            }
        }
    }

    clear(){
        this.grid.clear();
    }

    /** Returns the first collider it collides */
    collision(c: ColliderPart): ColliderPart | null {
        const possible = this.grid.region(c.rect);
        for(const p of possible){
            if(c.rect.intersects(p.rect)){
                if(c !== p)
                    return p;
            }
        }
        return null;
    }

    collision_list(c: ColliderPart): ColliderPart[] {   
        const all: ColliderPart[] = []
        
        const possible = this.grid.region(c.rect);
        for(const p of possible){
            if(c.rect.intersects(p.rect)){
                if(c !== p)
                    all.push(p);
            }
        }

        return all;
    }

    /** Ignores tag */
    all_colliders_on_point(point: Coordinate): readonly ColliderPart[] {
        const parts: ColliderPart[] = [];

        for(const c of this.grid.point(point)){
            if(c.rect.contains(point)) parts.push(c);
        }

        return parts;
    }

    colliders_on_point(point: Coordinate, tag: TagName): readonly ColliderPart[] {
        const parts: ColliderPart[] = [];

        for(const c of this.grid.point(point)){
            if(c.tag === tag){
                if(c.rect.contains(point)) parts.push(c)
            }
        }

        return parts;
    }

    first_collider_on_point(point: Coordinate, tag: TagName): ColliderPart | null {
        
        for(const c of this.grid.point(point)){
            if(c.tag === tag){
                return c;
            }
        }

        return null;
    }

    

    circle_query(x: number, y: number, r: number): AbstractEntity[] {
        const entities: AbstractEntity[] = [];
        const possible = this.grid.region(new Rect(x - r, y - r, r * 2, r * 2));
        for(const p of possible){
            if(Rect.CollidesWithSphere(p.rect, x, y, r)) entities.push(p.owner);
        }
        return entities;
    }

    line_query(line: Line): AbstractEntity[] {
        const entities: AbstractEntity[] = [];
        const possible = this.grid.region(line.getAABB());
        for(const p of possible){
            if(Rect.CollidesWithLine(p.rect,line.A.x,line.A.y,line.B.x,line.B.y)) entities.push(p.owner);
        }
        return entities;
    }

    // Draws collision boxes for debugging, red if colliding
    draw(g: Graphics){
        this.grid.draw(g);

        // draw collisions
        for(const collider of this.colliders){
            const collision = this.collision_list(collider);
            for(const c of collision){
                c.rect.intersection(collider.rect).draw(g,0x0000FF);
            }
        }
    }
}





