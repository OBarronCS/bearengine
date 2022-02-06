import { Subsystem } from "shared/core/subsystem";
import { TerrainMesh } from "shared/core/terrainmanager";
import { SparseSet } from "shared/datastructures/sparseset";
import { Graphics } from "shared/node_modules/pixi.js";
import { NetworkPlatformGame } from "../core-engine/bearengine";


export class TerrainMeshEventHandler extends Subsystem<NetworkPlatformGame> {
    

    private drawers = new SparseSet<{redraw:boolean, g:Graphics, m: TerrainMesh }>();

    init(): void {
        
        this.game.terrain.mesh_events.add_handler({
            on_clear: () => {
                this.drawers.values().forEach(g => g.g.destroy());
                this.drawers.clear();
            },
            on_add: (mesh: TerrainMesh) => {
                const g = this.game.engine.renderer.createCanvas();
                this.drawers.set(mesh.id, { m: mesh, redraw: true, g });
            },
            on_remove: (mesh: TerrainMesh) => {
                this.drawers.get(mesh.id).g.destroy();
                this.drawers.remove(mesh.id);
            },
            on_mutate: (mesh: TerrainMesh) => {
                this.drawers.get(mesh.id).redraw = true;
            },

        })
    }


    update(delta: number): void {
        for(const d of this.drawers.values()){
            if(d.redraw){
                d.redraw = false;
                d.m.draw(d.g);
            }
        }
    }

}


