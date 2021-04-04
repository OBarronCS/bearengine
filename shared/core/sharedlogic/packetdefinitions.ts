// Make sure to recompile client after changing these, or else
// everything will break and the bug will be impossible to track down
// because it's enum values wouldn't have changed, leading to it thinking its sending a different packet

export enum ClientBoundPacket {
    PONG, // [ original stamp: BigInt64, server stamp: BigInt64]
    INIT, // [ tick_rate: uint8, reference time: biguint64, tick: uint16, uint8: your_player_id] 
    START_TICKING, // [tick: uint16]

    
    GAME_STATE_PACKET // points to GamePacket
}

export enum GamePacket {
    REMOTE_ENTITY_CREATE, // [ SHARED_ID: uint8, instance_id: uint16]
    REMOTE_ENTITY_VARIABLE_CHANGE, // [ SHARED_ID: uint8, instance id: uint16, ...data]


    REMOTE_FUNCTION_CALL, // [shared function id, ...function argument data]

    
    SIMPLE_POSITION,
    PLAYER_POSITION,
    ENTITY_DESTROY, // used with players right now 

    
    PASSTHROUGH_TERRAIN_CARVE_CIRCLE, // [playerWhoDidIt: uint8, x: double, y: double, r: int32]
}


export enum ServerBoundPacket {
    PING, // [timestamp: BigInt64]
    CLIENT_STATE_PACKET // envelopes ClientPacket's
}

export enum ClientPacket {
    JOIN_GAME, // [empty packet]
    LEAVE_GAME, // [empty packet]
    
    PLAYER_POSITION,

    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]
}





