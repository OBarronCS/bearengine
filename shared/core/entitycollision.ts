
/*
Two uses:
    Deals with potential collision between entities
    Collision querys to find entities that lie under some query (line, box, circle)

    Some entities are moving, some stay in place, many only live for a couple seconds. 

Only for collision detection for AABB's. No resolution.
*/

import type { Graphics } from "pixi.js";
import { Line } from "shared/shapes/line";
import { Rect } from "shared/shapes/rectangle";
import { SpatialGrid } from "shared/datastructures/spatialgrid";
import { AbstractEntity } from "shared/core/abstractentity";
import { ColliderPart } from "./abstractpart";
import { Subsystem } from "./subsystem";


export class CollisionManager extends Subsystem {
    
    init(): void {}

    // With lots of entities, this will probably become a bottleneck, because it rebuilds the grid every step, but it works fine for now
    private colliders: ColliderPart[] = [];
    private grid: SpatialGrid<ColliderPart>;

    public collider_query = this.addQuery(ColliderPart,
        e => this.add(e), 
        e => this.remove(e)
    );

    setupGrid(worldWidth: number, worldHeight: number){
        this.grid = new SpatialGrid<ColliderPart>(worldWidth,worldHeight,6,6,(collider) => collider.rect);
    }

    update(dt: number): void {
        for(const collider of this.colliders){
            collider.setPosition(collider.owner.position);
        }

        this.grid.clear();
        for (let i = 0; i < this.colliders.length; i++) {
            this.grid.insert(this.colliders[i]);
        }
    }

    clear(){
        this.grid.clear();
        this.colliders = [];
    }

    add(c: ColliderPart){
        this.colliders.push(c);
        this.grid.insert(c);
    }

    remove(c: ColliderPart){
        const i = this.colliders.indexOf(c);
        if(i !== -1){
            this.colliders[i] = this.colliders[this.colliders.length - 1];
            this.colliders.pop();

            // Dont bother removing it from the grid yet.
            // It just won't be added back when I rebuild next step
            // This will have no bugs when I implement the deferal of entity deletion
        }
    }

    // return the first thing that it finds that this collides with
    collision(c: ColliderPart): ColliderPart {
        const possible = this.grid.region(c.rect);
        for(const p of possible){
            if(c.rect.intersects(p.rect)){
                if(c !== p)
                    return p;
            }
        }
        return null;
    }

    // ----    QUERIES
    circleQuery(x: number, y: number, r: number): AbstractEntity[] {
        const entities: AbstractEntity[] = [];
        const possible = this.grid.region(new Rect(x - r, y - r, r * 2, r * 2));
        for(const p of possible){
            if(Rect.CollidesWithSphere(p.rect, x, y, r)) entities.push(p.owner);
        }
        return entities;
    }

    lineQuery(line: Line){
        const entities: AbstractEntity[] = [];
        const possible = this.grid.region(line.getAABB());
        for(const p of possible){
            if(Rect.CollidesWithLine(p.rect,line.A.x, line.A.y,line.B.x,line.B.y)) entities.push(p.owner);
        }
        return entities;
    }

    // Draws collision boxes, red if colliding
    draw(g: Graphics){
        this.grid.draw(g);
        // only for debugging. This is n squared.
        // draw collisions
        for(const collider of this.colliders){
            const collision = this.collision(collider);
            if(collision !== null){
                collision.rect.intersection(collider.rect).draw(g,0xFF0000);
            }
        }
    }
}





