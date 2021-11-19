import { DefineSchema, GenerateLinker } from "./serialization";


export const LevelRef = DefineSchema<{ [key: string]: string }>()({
    LEVEL_ONE: "firsttest.json",
    LEVEL_TWO: "secondlevel.json",
} as const);

export const LevelRefLinker = GenerateLinker(LevelRef);





export const ArtRef = DefineSchema<{ [key: string]: string }>()({

    
} as const);

export const ArtRefLinker = GenerateLinker(ArtRef);

