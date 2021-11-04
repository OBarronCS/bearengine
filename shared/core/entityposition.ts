import { SpatialGrid } from "shared/datastructures/spatialgrid";
import { Graphics } from "shared/graphics/graphics";
import { Ellipse } from "shared/shapes/ellipse";
import { Rect } from "shared/shapes/rectangle";
import { drawPoint } from "shared/shapes/shapedrawing";
import { Vec2 } from "shared/shapes/vec2";
import { AbstractEntity } from "./abstractentity";
import { Subsystem } from "./subsystem";




export class CollisionManager extends Subsystem {
    
    init(): void {}

    // With lots of entities, this will probably become a bottleneck, because it rebuilds the grid every step, but it works fine for now
    private grid: SpatialGrid<AbstractEntity> = new SpatialGrid(1,1,1,1,(v) => Rect.fromPoints(v.position));


    setupGrid(worldWidth: number, worldHeight: number){
        this.grid = new SpatialGrid<AbstractEntity>(worldWidth,worldHeight,6,6,(v) => Rect.fromPoints(v.position));
    }

    update(dt: number): void {
        
        this.grid.clear();

        // Re-insert, re-position
        for(const e of this.game.entities.entities){
            this.grid.insert(e);
        }
    }

    clear(){
        this.grid.clear();
    }

    /** Returns all entities that are within the given circle */
    circleQuery(x: number, y: number, r: number): AbstractEntity[] {
        const entities: AbstractEntity[] = [];

        const circle = new Ellipse(new Vec2(x,y),r,r);

        const possible = this.grid.region(new Rect(x - r, y - r, r * 2, r * 2));

        for(const p of possible){
            if(circle.contains(p.position)) entities.push(p);
        }

        return entities;
    }

    

    // Draws collision boxes, red if colliding
    draw(g: Graphics){
        this.grid.draw(g);

        // only for debugging. This is n squared.
        // draw collisions
        for(const collider of this.game.entities.entities){
            drawPoint(g,collider.position);
        }
    }
}




