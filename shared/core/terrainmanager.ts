import { Line, lines_intersect } from "shared/shapes/line";
import {  Vec2, Coordinate, distanceSquared, mix, coordinateArraytoVec } from "shared/shapes/vec2";
import { SpatialGrid } from "shared/datastructures/spatialgrid";

import { Graphics } from "pixi.js";
import { drawLineBetweenPoints, drawPoint, drawVecAsArrow } from "shared/shapes/shapedrawing";
import { Polygon } from "shared/shapes/polygon";
import { Ellipse } from "shared/shapes/ellipse";
import { atan2, cos, sin, TWO_PI } from "shared/mathutils";



export class TerrainManager {

	private grid: SpatialGrid<TerrainMesh>;
	
	width: number;
	height: number;
	
	grid_width = 20
	grid_height = 20 

    /// TerrainMesh objects --> the individual bodies --> not really used in any calculations
    terrains: TerrainMesh[] = [];

    constructor(world_width: number, world_height: number){

 		this.width = world_width
		this.height = world_height; 

		this.grid = new SpatialGrid<TerrainMesh>(world_width, world_height,this.grid_width, this.grid_height,
			terrain => terrain.polygon.getAABB()
		);
    }

	draw(g: Graphics){
		this.terrains.forEach((t) => {
			t.draw(g);
		});

		this.grid.draw(g); // Draws it with grid lines included, and with the aabbs of the lines
	}
	
	/// Adds all terrain info --> adds to grid buckets
	addTerrain(points: number[],normals: number[]): void{
		const newTerrain = new TerrainMesh(new Polygon(coordinateArraytoVec(points),coordinateArraytoVec(normals)));
		this.terrains.push(newTerrain);
		this.grid.insert(newTerrain)
	}
	
	// Terrain Raycast: return null if no collision, otherwise closest point of intersection 
	lineCollision(A: Coordinate,B: Coordinate): {point:Vec2,normal:Vec2} {
		const box = (new Line(A,B)).getAABB();
		
		const possibleCollisions = this.grid.region(box);
		
		let answer:ReturnType<TerrainManager["lineCollision"]> = null;
		let answer_dist = -1;
			
		// This might be a performance barrier --> its a set, not an array. Iterable though
		for(const terrainMesh of possibleCollisions){
			
			const collision = terrainMesh.lineCollision(A, B);

			if(collision === null) continue;

			const dist = Vec2.distanceSquared(A, collision.point);
			
			// If no answer yet, choose this
			if(answer === null || dist < answer_dist) {
				answer_dist = dist
		
				answer = collision;
			}
		}
		
		return answer;
	}

	carveCircle(x: number,y: number, r: number): void {
		const box = (new Line({x: x-r, y: y-r},{x: x+r, y: y+r})).getAABB();

		const possibleCollisions = this.grid.region(box);

		for(const mesh of possibleCollisions){

			this.grid.remove(mesh);
			const result = mesh.carveCircle(x, y, r);

			if(result !== null){
				// reinsert the original one, since it has been broken up,
				this.grid.insert(mesh);
				
				//All the other ones
				for(const newMesh of result){
					this.grid.insert(newMesh);
					this.terrains.push(newMesh);
				}
			} else {
				// It might have gotten deleten
				if(mesh.polygon === null){
					this.terrains.splice(this.terrains.indexOf(mesh),1);
				} else {
					// it didn't get deleted: it only altered the original
					this.grid.insert(mesh);
				}
			}
		}
	}

}

// A polygon wrapper with extra functionality 
// special for colliding, mostly static, terrain
class TerrainMesh  {
	public polygon: Polygon;

	constructor(polygon: Polygon){
		this.polygon = polygon;
    }

	lineCollision(A: Coordinate, B: Coordinate): ReturnType<Polygon["lineIntersection"]> {
		return this.polygon.lineIntersection(A, B)
	}

	carveCircle(x: number,y: number, r: number): TerrainMesh[] | null{
		console.log(Polygon.isClockwise(this.polygon.points))
        //  if this breaks, its because of an edge case with overlapping points and floating point error

        const circle = new Ellipse(new Vec2(x,y),r,r);

        // contains the points of the resulting polygon
        const newPoints: Vec2[] = [];

        // contains the indices in the newPoints array of the new collision points'
        const addedIndices: number[] = [];

        for(let i = 0; i < this.polygon.points.length; i++){
            const firstPoint =  this.polygon.points[i];
            const secondPoint = this.polygon.points[(i + 1) % this.polygon.points.length];

            // Annoying EDGE CASE:
            // Breaks sometimes if a vertex is right on the edge of the sphere. 
            // Floating math makes it so sometimes it will be detected to be contained in the sphere, but not seen in line test

            // Edge case: collisionPoint recognizes the same point over multiple calls
            // It happens when the point is tangent. I discard these
            
            const collisionPoints = Line.CircleLineIntersection(firstPoint, secondPoint, x, y, r);
            
            if(!circle.contains(firstPoint)) newPoints.push(firstPoint);

            if(!collisionPoints.tangent){
                for(const point of collisionPoints.points){
                    newPoints.push(point);
                    addedIndices.push(newPoints.length - 1);
                    
                    // One more edge case that happens often
                    // If a vertex is on edge, might be detected 0,1, or 2 times.
                    // If 1 times, then it should try again cuz odd amount of indices
                    // If 2 times, than the added indicies will be all messed up.
                    // Because the will be on TOP of each other, and the program below assumes that they are NOT on top of each other
                    // Maybe: So if it becomes an array, check if any of the added index points are equal, and if so, call again with different r
                }  
            }
        }

        // If circle enveloped the entire polygon
        if(newPoints.length === 0){
            this.polygon = null;
            return null;
        }

		// Circle didn't even collide with lines or points
		if(addedIndices.length === 0) return null;

        // If not even number of collisions on edges, something broke due to edge case with vertex on sphere edge, 
        // try again with slightly different radius
        if(addedIndices.length % 2 !== 0){
            return this.carveCircle(x, y, r + 3)
        }

        // Sort the added indices by the points angle to the center of the sphere 
        addedIndices.sort((a,b) => {
            const p1 = newPoints[a];
            const p2 = newPoints[b];

            let p1Angle = atan2(p1.y - y, p1.x - x);
            let p2Angle = atan2(p2.y - y, p2.x - x);

            // console.log(p1Angle, p2Angle)
            return p2Angle - p1Angle;
        });

        console.log("Indices: ", addedIndices);
        console.log("Points: ", newPoints)

        // Algorithm 2.0: Here we go

        // Test the space between the first two points to determine the offset 
        let offset = 0;

        // Gets the point halfway between the first two points, and tests if it is in the polygon or not
        const p1 = newPoints[addedIndices[0]];
        const p2 = newPoints[addedIndices[1]];

        let startAngle = atan2(p1.y - y,p1.x - x);
        let endAngle = atan2(p2.y - y,p2.x - x);

        // This essentially just checks the angle clockwise, halfway between the two angles;
        if(startAngle < endAngle) startAngle += Math.PI * 2;

        const angleDiff = (startAngle - endAngle) / 2;
        const testAngle = startAngle - (angleDiff / 2);

        const testPoint = new Vec2(x + cos(testAngle) * r, y + sin(testAngle) * r);
        // console.log(testPoint)
        if(!this.polygon.contains(testPoint)){
            console.log("OFFSET")
            offset = 1;
        }


        // parralel array of connected components
        const islands: number[] = [];
        islands.length = newPoints.length;
        islands.fill(0);

        let freeIslandNumber = 0;

        // Key is the index where we add the points
        const addedCirclePointMap: Map<number,Vec2[]> = new Map();
        
        // Cycles through points and creates ALL the disconnected components
        for(let i = 0; i < addedIndices.length; i += 2){
            const ii = (i + offset) % addedIndices.length;
            const ii2 = (ii + 1) % addedIndices.length;

            // Index inside of the newPoints array denoting the beginning and end of where points should be filled in
            // Move clockwise (right) from index until get to index2. Will wrap around array at times.
            const index = addedIndices[ii];
            const index2 = addedIndices[ii2];

            freeIslandNumber += 1;

            // this and islands[index2] should always be equal
            const islandNumber = islands[index];

            let j = index;
            while(j !== index2){
                // Essentially, if this point doesn't belong to another group already
                if(islands[j] === islandNumber){
                    islands[j] = freeIslandNumber;
                }

                j = (j + 1) % newPoints.length;
            }

            // Add index2 as well. j == index2 here
            islands[j] = freeIslandNumber;

            // CREATING THE CIRCLE POINTS:
            
            const p1 = newPoints[index];
            const p2 = newPoints[index2];

            let startAngle = atan2(p1.y - y,p1.x - x);
            let endAngle = atan2(p2.y - y,p2.x - x);
            
            const VERTICES = 14;
            const initialOffset =  Math.PI * 2 / VERTICES // used to make sure points don't repeat

            if(endAngle > startAngle) endAngle -= TWO_PI;

            const circlePoints: Vec2[] = [];

            for(let i = startAngle - initialOffset; i > endAngle; i -= Math.PI * 2 / VERTICES)
                circlePoints.push(new Vec2(x + cos(i) * r, y + sin(i) * r));

            // reverse it due to the opposite ordering.
            addedCirclePointMap.set(index2, circlePoints.reverse());
        }

        //Now, we have created all the disconnected 'islands' of points (defined in islands array), we just need to make them seperate polygon objects
        // And add the points from the circle

        console.log(freeIslandNumber)
        console.log("Islands: " + islands)

        const components: Vec2[][] = [];

        // Each free number creates either nothing, or it creates an entire 
        for(let i = 0; i <= freeIslandNumber; i++){

            const points: Vec2[] = [];

            for(let j = 0; j < newPoints.length; j++){
                // remember, newPoints and island are parralel arrays
                if(islands[j] === i){
                    points.push(newPoints[j]);

                    const possibleAddedPoints = addedCirclePointMap.get(j);
                    if(possibleAddedPoints !== undefined){
                        points.push(...possibleAddedPoints);
                    }
                }
            }

            if(points.length !== 0) components.push(points);
        }


        // ONE MORE EDGE CASE CHECK MAYBE:
        // In some floating point math error cases, I will get polygon's that are just two points on top of each other
   
		this.polygon = Polygon.from(components[0]);

		const returnMeshes: TerrainMesh[] = [];
        for(let i = 1; i < components.length; i++){
			returnMeshes.push(new TerrainMesh(Polygon.from(components[i])));
        }

		return returnMeshes.length === 0 ? null : returnMeshes;
    }

	draw(g: Graphics){
		this.polygon.draw(g, 0x900C3F);
	}
}



