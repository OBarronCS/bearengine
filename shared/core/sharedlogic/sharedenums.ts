

export enum ClientPlayState {
    ACTIVE,
    GHOST,
    SPECTATING
}

export enum MatchGamemode {
    INFINITE,
    FIRST_TO_N,
    GUN_GAME,
    // TEAMS
}

export function EnumKeys(_enum: object){
    const keys = [];

    for(const key in _enum){
        // Only lets the strings filter through
        if(isNaN(Number(key))){
            keys.push(key)
        }
    }

    return keys
}

export function EnumCount(obj: object): number {
    return (Object.keys(obj).length / 2)
}


