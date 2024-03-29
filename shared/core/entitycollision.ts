
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
import { AbstractEntity, EntityID } from "shared/core/abstractentity";
import { Subsystem } from "./subsystem";
import { Attribute, AttributeCtor, get_attribute_id, get_attribute_id_from_type } from "./entityattribute";
import { Vec2, Coordinate } from "shared/shapes/vec2";
import { CustomEventDispatcher } from "./bearevents";


/**
 * Layers will be used to do a quick check to see if we should even bother checking collision. 
 */
const DEFAULT_LAYER = "DEFAULT_LAYER";
const layers = [
    DEFAULT_LAYER,
] as const;
export type LayerName = typeof layers[number];


export class ColliderPart extends Attribute {

    public readonly rect: Rect; // bbox
    /* Where on the rectangle is the position */
    public readonly offset: Vec2;

    public check_collisions = false;


    readonly on_active_collision_callbacks = new Map<number,((attr: Attribute) => void)>();

    /** Set of other entity id's currently colliding with. Checked every tick */
    readonly current_tick_active_collisions = new Set<EntityID>();
    readonly last_tick_active_collisions = new Set<EntityID>();
    
    readonly on_start_collision_callbacks = new Map<number,((attr: Attribute) => void)>();
    readonly on_end_collision_callbacks = new Map<number, ((attr: Attribute) => void)>();


    constructor(dimensions: Dimension, offset: Coordinate){
        super();
        this.rect = new Rect(0,0,dimensions.width, dimensions.height);
        this.offset = new Vec2(-offset.x,-offset.y);
    }

    setPosition(spot: Coordinate){
        this.rect.moveTo(spot);
        this.rect.translate(this.offset);
    }
}


interface CollisionQueryData<T extends AttributeCtor> {
    attr: InstanceType<T>,
    entity: AbstractEntity,
    collider: ColliderPart
}


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

            collider.on_active_collision_callbacks.set(get_attribute_id_from_type(other_type), (attr: Attribute) => {
                entity[method_name](attr);
            });

            collider.check_collisions = true;
        },
        (sparse_index: number) => {
            console.error("IMPLEMENT THIS");
        }
    ));

    private readonly start_collisions = this.addEventDispatcher(new CustomEventDispatcher("collision_start", 
        (sparse_index: number, entity: AbstractEntity, method_name: string, other_type: typeof Attribute) => {
            console.log("Collision for " + entity.constructor.name + " registered")
            const collider = entity.getAttribute(ColliderPart);
            if(collider == null){
                console.error("Cannot find collider part for entity: " + entity.constructor.name)
                return;
            }

            if(get_attribute_id_from_type(other_type) === -1) this.game.entities["register_new_attribute_type"](other_type);

            collider.on_start_collision_callbacks.set(get_attribute_id_from_type(other_type), (attr: Attribute) => {
                entity[method_name](attr);
            });

            collider.check_collisions = true;
        },
        (sparse_index: number) => {
            console.error("IMPLEMENT THIS");
        }
    ));

    private readonly end_collisions = this.addEventDispatcher(new CustomEventDispatcher("collision_end", 
        (sparse_index: number, entity: AbstractEntity, method_name: string, other_type: typeof Attribute) => {
            console.log("Collision for " + entity.constructor.name + " registered")
            const collider = entity.getAttribute(ColliderPart);
            if(collider == null){
                console.error("Cannot find collider part for entity: " + entity.constructor.name)
                return;
            }

            if(get_attribute_id_from_type(other_type) === -1) this.game.entities["register_new_attribute_type"](other_type);

            collider.on_end_collision_callbacks.set(get_attribute_id_from_type(other_type), (attr: Attribute) => {
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

                //
                collider.current_tick_active_collisions.clear();

                for(const other of this.gen_collision_list(collider)){

                    // On start callbacks
                    if(!collider.last_tick_active_collisions.has(other.owner.entityID)){
                        for(const val of collider.on_start_collision_callbacks.keys()){

                            if(this.game.entities.hasAttributeByID(other.owner.entityID,val)){
                                collider.on_start_collision_callbacks.get(val)(this.game.entities.getAttributeByID(other.owner.entityID, val));
                            }
                        }
                    }

                    // Active collisions
                    // Check if it matches any of the registered callbacks
                    for(const val of collider.on_active_collision_callbacks.keys()){
                        if(this.game.entities.hasAttributeByID(other.owner.entityID,val)){
                            collider.on_active_collision_callbacks.get(val)(this.game.entities.getAttributeByID(other.owner.entityID, val));
                        }
                    }

                    // Add the other entity to the list of entities collided with
                    collider.current_tick_active_collisions.add(other.owner.entityID);

                }

                //
                for(const e of collider.last_tick_active_collisions){
                    if(!collider.current_tick_active_collisions.has(e)){

                        for(const val of collider.on_end_collision_callbacks.keys()){

                            if(this.game.entities.hasAttributeByID(e,val)){
                                collider.on_end_collision_callbacks.get(val)(this.game.entities.getAttributeByID(e, val));
                            }
                        }
                    }
                }


                collider.last_tick_active_collisions.clear();
                for(const e of collider.current_tick_active_collisions){
                    collider.last_tick_active_collisions.add(e);
                }
                //
    

            }
        }
    }

    clear(){
        this.grid.clear();
    }

    /** Returns collisions with given collider, other entities must have given attribute */
    collision_list<T extends AttributeCtor>(c: ColliderPart, attr: T): CollisionQueryData<T>[] {
        const entities: CollisionQueryData<T>[] = []

        const possible = this.grid.region(c.rect);
        for(const p of possible){
            if(c.rect.intersects(p.rect)){
                if(c !== p){
                    const at = p.owner.getAttribute(attr);
                    if(at !== null){
                        entities.push({
                            attr:at,
                            entity:p.owner,
                            collider:p,
                        });
                    }

                }
            }
        }

        return entities;
    }

    /** General collision list, returns ALL COLLIDERS that collide with it */
    gen_collision_list(c: ColliderPart): ColliderPart[] {   
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

    /** Return all colliding entities with the given attribute */
    point_query_list<T extends AttributeCtor>(point: Coordinate, attr: T): CollisionQueryData<T>[] {
        
        const found: CollisionQueryData<T>[] = [];

        for(const c of this.grid.point(point)){
            if(c.rect.contains(point)){
                const b = c.owner.getAttribute(attr);
                if(b !== null){
                    found.push({
                        attr:b,
                        entity:c.owner,
                        collider:c,
                    })
                }
            }   
        }

        return found;
    }

    rectangle_query_list<T extends AttributeCtor>(rect: Rect, attr: T): CollisionQueryData<T>[] {
        
        const found: CollisionQueryData<T>[] = [];

        for(const c of this.grid.region(rect)){
            if(c.rect.intersects(rect)){
                const b = c.owner.getAttribute(attr);
                if(b !== null){
                    found.push({
                        attr:b,
                        entity:c.owner,
                        collider:c,
                    })
                }
            }   
        }

        return found;
    }
    
    /** Return all colliding entities with the given attribute. Pass in null to get all colliders */
    circle_query_list<T extends AttributeCtor>(x: number, y: number, r: number, attr: T): CollisionQueryData<T>[];
    circle_query_list(x: number, y: number, r: number, attr: null): CollisionQueryData<null>[];
    circle_query_list<T extends AttributeCtor>(x: number, y: number, r: number, attr: T | null): CollisionQueryData<T>[] {
        const entities: CollisionQueryData<T>[] = [];
        const possible = this.grid.region(new Rect(x - r, y - r, r * 2, r * 2));
        for(const p of possible){
            if(Rect.CollidesWithSphere(p.rect, x, y, r)) {
                if(attr === null){
                    entities.push({
                        attr:null,
                        entity:p.owner,
                        collider:p,
                    });
                } else {
                    const at = p.owner.getAttribute(attr);
                    if(at !== null){
                        entities.push({
                            attr:at,
                            entity:p.owner,
                            collider:p,
                        });
                    }
                }
            }
        }
        return entities;
    }


    line_query<T extends AttributeCtor>(line: Line, attr: T): CollisionQueryData<T>[] {
        const entities: CollisionQueryData<T>[] = [];
        const possible = this.grid.region(line.getAABB());
        for(const p of possible){
            if(Rect.CollidesWithLine(p.rect,line.A.x,line.A.y,line.B.x,line.B.y)) { 
                const at = p.owner.getAttribute(attr);
                if(at !== null){
                    entities.push({
                        attr:at,
                        entity:p.owner,
                        collider:p,
                    });
                }
            }
        }

        return entities;
    }

    // Draws collision boxes for debugging, red if colliding
    draw(g: Graphics){
        this.grid.draw(g);

        // draw collisions
        for(const collider of this.colliders){
            const collision = this.gen_collision_list(collider);
            for(const c of collision){
                c.rect.intersection(collider.rect).draw(g,0x0000FF);
            }
        }
    }
}





