// Make sure to recompile client after changing these, or else
// everything will break and the bug will be impossible to track down
// because it's enum values wouldn't have changed, leading to it thinking its sending a different packet

export enum ClientBoundPacket {
    PONG, // response to client ping
    INIT, // [ tick_rate: uint8, reference time: biguint64, tick: uint16] 
    START_TICKING, // [tick: uint16]

    
    GAME_STATE_PACKET // points to GamePacket
}

export enum GamePacket {
    REMOTE_ENTITY_CREATE, // [ SHARED ID of the class, instance id]
    REMOTE_ENTITY_VARIABLE_CHANGE, // [ instance id, ...data]


    REMOTE_FUNCTION_CALL, // [shared function id, ...function argument data]

    SIMPLE_POSITION,
    PLAYER_POSITION,
    ENTITY_DESTROY, // used with players right now 

    
    PASSTHROUGH_TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]
}


export enum ServerBoundPacket {
    PING,
    CLIENT_STATE_PACKET // envelopes ClientPacket's
}

export enum ClientPacket {
    JOIN_GAME,
    LEAVE_GAME, // sent internally
    PLAYER_POSITION,

    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]
}





