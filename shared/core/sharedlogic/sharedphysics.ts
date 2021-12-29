import { Vec2, Coordinate } from "shared/shapes/vec2";
import { TerrainManager } from "../terrainmanager";

export interface SimpleBounceInfo {
    stopped: boolean
}

/** Mutates the passed in position, velocity.
 *  Simulates a tick of simple bouncing physics
 */
export function SimpleBouncePhysics(terrain: TerrainManager, position: Vec2, velocity: Vec2, gravity: Readonly<Coordinate>, slow_factor: number): SimpleBounceInfo {
    
    velocity.add(gravity);

    const destination = Vec2.add(position,velocity);

    // If no terrain hit, proceed
    const test = terrain.lineCollisionExt(position, destination);

    if(test === null){
        position.add(velocity);
    } else {

        if(velocity.length() <= 3){
            return {
                stopped: true
            }
        }

        // Could potentially bounce multiple times;
        let last_test = test;
        let distanceToMove = velocity.length();

        const max_iter = 10;
        let i = 0;

        while(distanceToMove > 0 && i++ < max_iter){
            // console.log("Tick: " + this.game.tick, " " + distanceToMove)

            const distanceToPoint = Vec2.subtract(last_test.point,position).length();

            // const distanceAfterBounce = distanceToMove - distanceToPoint;

            // Set my position to colliding point, then do more logic later
            position.set(last_test.point);

            // Bounce off of wall, set velocity
            Vec2.bounce(velocity, last_test.normal, velocity);

            

            // Slows done
            velocity.scale(slow_factor);

            distanceToMove -= distanceToPoint;
            distanceToMove *= slow_factor;

            // const lastStretchVel = this.velocity.clone().normalize().scale(distanceAfterBounce);
            const lastStretchVel = velocity.clone().normalize().scale(distanceToMove);
            // Move forward
            const bounce_test = terrain.lineCollisionExt(position, Vec2.add(position, lastStretchVel));

            if(bounce_test === null || bounce_test.normal.equals(last_test.normal)){
                position.add(lastStretchVel);

                if(terrain.pointInTerrain(position)) {
                    return {
                        stopped: true
                    }
                }
                break;
            }

            last_test = bounce_test   
        }
    }

    return {
        stopped: false
    }
}