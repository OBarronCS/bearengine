import { EmitterConfigV1, EmitterConfigV3 } from "shared/graphics/particles";
import { DefineSchema } from "shared/core/sharedlogic/serialization";
import { GenerateLinker } from "shared/core/sharedlogic/serialization";






export const PARTICLE_CONFIG = DefineSchema<{ [key: string]: EmitterConfigV1 | EmitterConfigV3; }>()({
    ROCKET: {
        "alpha": {
            "start": 1,
            "end": 0.82
        },
        "scale": {
            "start": 0.2,
            "end": 0.01,
            "minimumScaleMultiplier": 1
        },
        "color": {
            "start": "#aecfd9",
            "end": "#000000"
        },
        "speed": {
            "start": 50,
            "end": 50,
            "minimumSpeedMultiplier": 1
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
            "min": 0,
            "max": 8
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
        "alpha": {
            "start": 0.8,
            "end": 0.1
        },
        "scale": {
            "start": 1,
            "end": 0.3,
            "minimumScaleMultiplier": 1
        },
        "color": {
            "start": "#fb1010",
            "end": "#f5b830"
        },
        "speed": {
            "start": 200,
            "end": 100,
            "minimumSpeedMultiplier": 1
        },
        "acceleration": {
            "x": 0,
            "y": 0
        },
        "maxSpeed": 0,
        "startRotation": {
            "min": 0,
            "max": 360
        },
        "noRotation": false,
        "rotationSpeed": {
            "min": 0,
            "max": 0
        },
        "lifetime": {
            "min": 0.5,
            "max": 0.5
        },
        "blendMode": "normal",
        "frequency": 0.008,
        "emitterLifetime": 0.31,
        "maxParticles": 1000,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "circle",
        "spawnCircle": {
            "x": 0,
            "y": 0,
            "r": 10
        }
    },
    ROUND_WINNER: {
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
    },
    BOOM: {
        "alpha": {
            "start": 1,
            "end": 0.19
        },
        "scale": {
            "start": 1,
            "end": 0.3,
            "minimumScaleMultiplier": 1
        },
        "color": {
            "start": "#fd1111",
            "end": "#f77a31"
        },
        "speed": {
            "start": 200,
            "end": 100,
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
            "min": 0.5,
            "max": 0.5
        },
        "blendMode": "normal",
        "frequency": 0.1,
        "emitterLifetime": 0.31,
        "maxParticles": 1000,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "burst",
        "particlesPerWave": 9,
        "particleSpacing": 0,
        "angleStart": 0
    },
    HIT_SPLAT: {
        "alpha": {
            "start": 1,
            "end": 0.82
        },
        "scale": {
            "start": 0.2,
            "end": 0.01,
            "minimumScaleMultiplier": 1
        },
        "color": {
            "start": "#e3033e",
            "end": "#331614"
        },
        "speed": {
            "start": 45,
            "end": 10,
            "minimumSpeedMultiplier": 1
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
            "min": 0,
            "max": 8
        },
        "lifetime": {
            "min": 0.2,
            "max": 0.8
        },
        "blendMode": "normal",
        "frequency": 0.001,
        "emitterLifetime": 0.4,
        "maxParticles": 20,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "burst",
        "particlesPerWave": 2,
        "particleSpacing": 0,
        "angleStart": 0
    }
});


export const PARTICLE_LINKER = GenerateLinker(PARTICLE_CONFIG);


