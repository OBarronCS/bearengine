import { Graphics } from "shared/graphics/graphics";


import { SpatialGrid } from "shared/datastructures/spatialgrid";
import { Line } from "shared/shapes/line";
import { CarveResult, Polygon } from "shared/shapes/polygon";
import { Rect } from "shared/shapes/rectangle";
import { Coordinate, coordinateArraytoVec, mix, Vec2 } from "shared/shapes/vec2";
import { Subsystem } from "./subsystem";
import { EventHub } from "./eventhub";
import { Color, rgb } from "shared/datastructures/color";


interface LineCollisionResult {
    point: Vec2;
    normal: Vec2;
    mesh: Readonly<TerrainMesh>;
}

type MeshEvents = {
    on_clear: () => void
    on_add: (terrain_mesh: TerrainMesh) => void
    on_remove: (terrain_mesh: TerrainMesh) => void
    on_mutate: (terrain_mesh: TerrainMesh) => void
    // on_hit: (terrain_mesh: TerrainMesh) => void
}

/**
 * Server says number 7 was hit;
 * TerrainManager has SparseSet of TerrainMeshes'
 *      Gets the one with id 7.
 * 
 *      call this.terrain_mesh_events.call("on_hit", get(7));
 *          this.will call all handlesr, which 
 */
export class TerrainManager extends Subsystem {
    
    readonly mesh_events = new EventHub<MeshEvents>();

    //TerrainMesh objects --> the individual bodies
    private terrains: TerrainMesh[] = [];
    private next_terrain_id = 0;


    private grid: SpatialGrid<TerrainMesh> = new SpatialGrid<TerrainMesh>(1,1,1,1,(t) => t.polygon.getAABB());
    
    width: number;
    height: number;
    
    grid_width = 20;
    grid_height = 20;

    // call this externally to properly initialize
    setupGrid(world_width: number, world_height: number){
        this.width = world_width
        this.height = world_height; 

        this.grid = new SpatialGrid<TerrainMesh>(world_width, world_height,this.grid_width, this.grid_height,
            terrain => terrain.polygon.getAABB()
        );
    }

    init(): void {

    }

    update(delta: number): void {

    }

    clear(){
        this.mesh_events.dispatch("on_clear");

        this.next_terrain_id = 0;
        this.grid.clear();
        this.terrains = [];
    }
    
    //Adds all terrain info --> adds to grid buckets
    addTerrain(points: number[], normals: number[], tag: string): void {
        const poly = new Polygon(coordinateArraytoVec(points),coordinateArraytoVec(normals));

        const new_mesh = new TerrainMesh(poly, tag, this.next_terrain_id++);
        this.terrains.push(new_mesh);
        this.grid.insert(new_mesh);

        this.mesh_events.dispatch("on_add", new_mesh);
    }

    get_terrain_by_tag(tag: string): TerrainMesh[] {
        const terrains: TerrainMesh[] = [];
        for(const t of this.terrains){
            if(t.tag === tag) terrains.push(t);
        }

        return terrains;
    }

    pointInTerrain(point: Coordinate): boolean {
        for(const p of this.grid.region(Rect.from_points(point))) {
            if(p.polygon.contains(point)) return true;
        }
        
        return false;
    }
    
    /** Terrain Raycast: return null if no collision, otherwise closest point of intersection */
    lineCollision(A: Coordinate, B: Coordinate): LineCollisionResult | null {
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
                answer_dist = dist;
                answer = {
                    ...collision,
                    mesh: terrainMesh
                }
            }
        }
        
        return answer;
    }

    lineCollisionExt(A: Coordinate, B: Coordinate): { point: Vec2, normal: Vec2, line: Line } | null {
        const box = Vec2.AABB(A,B);
        
        const possibleCollisions = this.grid.region(box);
        
        let answer:ReturnType<TerrainManager["lineCollisionExt"]> = null;
        let answer_dist = -1;
            
        // This might be a performance barrier --> its a set, not an array. Iterable though
        for(const terrainMesh of possibleCollisions){
            
            const collision = terrainMesh.polygon.lineIntersectionWithExtraInfo(A, B);

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


    process_carve_result(target_mesh: TerrainMesh, carve_result: CarveResult): void {
        if(carve_result.type === "missed") {
            return;
        } else if(carve_result.type === "total"){
            // Completely remove all references to this terrain
            this.grid.remove(target_mesh);
            this.terrains.splice(this.terrains.indexOf(target_mesh),1);

            this.mesh_events.dispatch("on_remove", target_mesh);
        } else if(carve_result.type === "normal"){
            // First remove all original references
            this.grid.remove(target_mesh);
            this.terrains.splice(this.terrains.indexOf(target_mesh),1);

            //Then add all the new meshes into the field!

            //All the other ones
            for(const new_mesh of carve_result.parts){
                const m = new TerrainMesh(new_mesh,target_mesh.tag,this.next_terrain_id++)

                this.grid.insert(m);
                this.terrains.push(m);

                this.mesh_events.dispatch("on_add", m);
            }

            this.mesh_events.dispatch("on_remove", target_mesh);
        }
    }

    carveCircle(x: number,y: number, r: number): void {
        const box = (new Line({x: x-r, y: y-r},{x: x+r, y: y+r})).getAABB();

        const possibleCollisions = this.grid.region(box);

        for(const mesh of possibleCollisions){

            const carve_result = mesh.polygon.carve_circle(x, y, r);

            this.process_carve_result(mesh,carve_result);
        }
    }

    carvePolygon(polygon: Polygon, shift: Vec2): void {
        const box = polygon.getAABB().translate(shift);

        /// console.log(box)

        const possibleCollisions = this.grid.region(box);

        for(const mesh of possibleCollisions){

            const carve_result = mesh.polygon.carve_polygon(polygon, shift);
            this.process_carve_result(mesh,carve_result);
        }
    }

}

// A polygon wrapper with extra functionality for identifying a certain piece of terrain
// special for colliding, mostly static, terrain
export class TerrainMesh  {
    readonly tag: string;
    readonly id: number;
    color: Color = rgb(144, 12, 63); // Color.random();
    polygon: Polygon;

    constructor(polygon: Polygon, tag: string, id: number){
        this.polygon = polygon;
        this.tag = tag;
        this.id = id;
    }

    lineCollision(A: Coordinate, B: Coordinate): ReturnType<Polygon["lineIntersection"]> {
        return this.polygon.lineIntersection(A, B);
    }

    reset_color(){
        this.color.copyFrom(rgb(144, 12, 63));
    }

    draw(g: Graphics){
        this.polygon.draw(g, this.color.hex(), false, true, false);
    }
}
