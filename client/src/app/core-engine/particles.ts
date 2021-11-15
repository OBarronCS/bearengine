import { Emitter, EmitterConfigV2 } from "shared/graphics/particles";
import { AbstractEntity } from "shared/core/abstractentity";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { Entity } from "./entity";
import { Texture } from "shared/graphics/graphics";
import { PARTICLE_CONFIG } from "shared/core/sharedlogic/sharedparticles";
import { Vec2 } from "shared/shapes/vec2";



// Attaches an emitter to an entity
// Destroys self if entity is destroyed, or once the emitter is finished
export class EmitterAttach extends Entity {

    private emitter: Emitter;

    constructor(public targetEntity: AbstractEntity, part: keyof typeof PARTICLE_CONFIG, path: string, public offset = new Vec2()){
        super();
        this.emitter = this.engine.renderer.addEmitter(path, PARTICLE_CONFIG[part], this.targetEntity.x + offset.x, this.targetEntity.y + offset.y);
    }


    update(dt: number): void {
        if(this.targetEntity.entityID !== NULL_ENTITY_INDEX){
            this.emitter.updateSpawnPos(this.targetEntity.x + this.offset.x,this.targetEntity.y + this.offset.y);
        } else {
            this.destroy();
        }

        if(!this.emitter.emit && !this.emitter["_activeParticlesFirst"]){
            this.destroy();
        }
    }

    override onDestroy(){
        this.emitter.destroy();
    }

}


