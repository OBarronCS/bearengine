import { Emitter, EmitterConfig, OldEmitterConfig } from "pixi-particles";
import { AbstractEntity } from "shared/core/abstractentity";
import { NULL_ENTITY_INDEX } from "shared/core/entitysystem";
import { DefineSchema } from "shared/core/sharedlogic/serialization";
import { Entity } from "./entity";



// Attaches an emitter to an entity
// Destroys self if entity is destroyed, or once the emitter is finished
export class EmitterAttach extends Entity {

    private emitter: Emitter;

    constructor(public targetEntity: AbstractEntity, part: keyof typeof PARTICLE_CONFIG, path: string){
        super();
        this.emitter = this.engine.renderer.addEmitter(path, PARTICLE_CONFIG[part], this.targetEntity.x, this.targetEntity.y);
    }


    update(dt: number): void {
        if(this.targetEntity.entityID !== NULL_ENTITY_INDEX){
            this.emitter.updateSpawnPos(this.targetEntity.x,this.targetEntity.y);
        } else {
            this.destroy();
        }

        if(!this.emitter.emit && !this.emitter["_activeParticlesFirst"]){
            this.destroy();
        }
    }

}

export const PARTICLE_CONFIG = DefineSchema<{ [key:string]: EmitterConfig | OldEmitterConfig } >()({
    ROCKET:{
        "alpha": {
            list: [
                {
                    value: 1,
                    time: 0,
                },
                {
                    value:.82,
                    time: 1,
                }
            ]
        },
        "scale": {
            list: [
                {
                    value: .2,
                    time: 0,
                },
                {
                    value:.01,
                    time: 1,
                }
            ],
        },
        "color": {
            list: [
                {
                    value: "#aecfd9",
                    time: 0,
                },
                {
                    value:"#000000",
                    time: 1,
                }
            ],
        },
        "speed": {

            list: [
                {
                    value: 50,
                    time: 0,
                },
                {
                    value:50,
                    time: 1,
                }
            ],
        },
        "acceleration": {
            "x": 0,
            "y": 0
        },
        "maxSpeed": 0,
        "startRotation": {
            "min": 180,
            "max": 360
        },
        "noRotation": false,
        "rotationSpeed": {
            "min": 8,
            "max": 0
        },
        "lifetime": {
            "min": 0.2,
            "max": 0.8
        },
        "blendMode": "normal",
        "frequency": 0.001,
        "emitterLifetime": -1,
        "maxParticles": 499,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "burst",
        "particlesPerWave": 2,
        "particleSpacing": 0,
        "angleStart": 0
    },
    TERRAIN_EXPLOSION: {
        alpha: {
            list: [
                {
                    value: 0.8,
                    time: 0
                },
                {
                    value: 0.1,
                    time: 1
                }
            ],
            isStepped: false
        },
        scale: {
            list: [
                {
                    value: 1,
                    time: 0
                },
                {
                    value: 0.3,
                    time: 1
                }
            ],
            isStepped: false
        },
        color: {
            list: [
                {
                    value: "fb1010",
                    time: 0
                },
                {
                    value: "f5b830",
                    time: 1
                }
            ],
            isStepped: false
        },
        speed: {
            list: [
                {
                    value: 200,
                    time: 0
                },
                {
                    value: 100,
                    time: 1
                }
            ],
            isStepped: false
        },
        startRotation: {
            min: 0,
            max: 360
        },
        rotationSpeed: {
            min: 0,
            max: 0
        },
        lifetime: {
            min: 0.5,
            max: 0.5
        },
        frequency: 0.008,
        spawnChance: 1,
        particlesPerWave: 1,
        emitterLifetime: 0.31,
        maxParticles: 1000,
        pos: {
            x: 0,
            y: 0
        },
        addAtBack: false,
        spawnType: "circle",
        spawnCircle: {
            x: 0,
            y: 0,
            r: 10
        }
    },
    ROUND_WINNER:{
        "alpha": {
            "start": 0.93,
            "end": 1
        },
        "scale": {
            "start": 0.04,
            "end": 0.26,
            "minimumScaleMultiplier": 0.95
        },
        "color": {
            "start": "#65c213",
            "end": "#3ca32a"
        },
        "speed": {
            "start": 300,
            "end": 90,
            "minimumSpeedMultiplier": 1
        },
        "acceleration": {
            "x": 0,
            "y": 0
        },
        "maxSpeed": 0,
        "startRotation": {
            "min": 0,
            "max": 0
        },
        "noRotation": false,
        "rotationSpeed": {
            "min": 0,
            "max": 0
        },
        "lifetime": {
            "min": 0.2,
            "max": 0.8
        },
        "blendMode": "normal",
        "frequency": 0.001,
        "emitterLifetime": 2.1,
        "maxParticles": 750,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "ring",
        "spawnCircle": {
            "x": 0,
            "y": 0,
            "r": 6,
            "minR": 2
        }
    }
});
