import { EmitterConfig, OldEmitterConfig } from "pixi-particles";
import { DefineSchema } from "shared/core/sharedlogic/serialization";


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
    }
});
