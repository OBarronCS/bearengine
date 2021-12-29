

export enum ClientPlayState {
    ACTIVE,
    GHOST,
    SPECTATING
}


export function EnumCount(obj: object): number {
    return (Object.keys(obj).length / 2)
}


