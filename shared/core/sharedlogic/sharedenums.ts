
export enum MatchGamemode {
    LOBBY,
    FREE_FOR_ALL,
    // GUN_GAME,
    // TEAMS

    // DURATIONS:
        // FIRST_TO_N,
        // N_ROUNDS,
        // INFINITE,
}

export enum ClientPlayState {
    ACTIVE,
    GHOST,
    SPECTATING
}


export function EnumKeys(_enum: object): string[] {
    const keys: string[] = [];

    for(const key in _enum){
        // Only lets the strings filter through
        if(isNaN(Number(key))){
            keys.push(key);
        }
    }

    return keys;
}

export function EnumCount(obj: object): number {
    return (Object.keys(obj).length / 2);
}


