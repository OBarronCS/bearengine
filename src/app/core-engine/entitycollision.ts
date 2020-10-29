
/*
Two uses:
    Deals with potential collision between entities (not terrain!)
    Collision querys to find what entities lie under some query (line, box, circle)

Entities are most likely things that move (player), things that can appear/dissapear (coins), 

Only for collision detection for AABB's. No resolution.
*/

import { Circle, Graphics } from "pixi.js";
import { Line } from "../math-library/shapes/line";
import { Rect } from "../math-library/shapes/rectangle";
import { SpatialGrid } from "../math-library/spatialgrid";
import { Entity } from "./entity";
import { ColliderPart } from "./parts";


// E.Collision
export class CollisionManager {
    
    // In the future, what lots of entities, this will probably become a bottleneck. Research more efficient data structures

    // Rebuild the grid every step

    private colliders: ColliderPart[] = [];

    private grid: SpatialGrid<ColliderPart>;

    constructor(worldWidth: number, worldHeight: number){
        this.grid = new SpatialGrid<ColliderPart>(worldWidth, worldHeight, 6,6,(collider) => collider.rect);
    }

    update(dt: number): void {
        this.grid.clear();
        for (let i = 0; i < this.colliders.length; i++) {
            this.grid.insert(this.colliders[i]);
        }
    }

    add(c: ColliderPart){
        this.colliders.push(c);
        this.grid.insert(c);
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

    remove(c: ColliderPart){
        const i = this.colliders.indexOf(c);
        if(i !== -1){
            this.colliders.splice(i,1);
            // Dont bother removing it from the grid yet.
            // It just won't be added back when I rebuild next step
            // This might be a cause of bugs tho! we'll see
        }
    }
    
    // ----    QUERIES
    circleQuery(x: number, y: number, r: number): Entity[] {
        const entities: Entity[] = [];
        const possible = this.grid.region(new Rect(x - r, y - r, r * 2, r * 2));
        for(const p of possible){
            if(Rect.CollidesWithSphere(p.rect, x, y, r)) entities.push(p.owner);
        }
        return entities
    }

    lineQuery(line: Line){
        const entities: Entity[] = [];
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





