// Remember to recompile client after changing these, or else
// everything will break and the bug will be impossible to track down

export enum ClientBoundSubType {
    IMMEDIATE, // points to ClientBoundImmediate
    QUEUE, // points to GamePacket
}

export enum ClientBoundImmediate {
    PONG, // [ original stamp: BigInt64, server stamp: BigInt64]
}

export enum GamePacket {
    INIT, // [ hash: uint64, tick_rate: uint8, reference time: biguint64, tick: uint16, uint8: your_player_id] 
    START_TICKING, // [tick: uint16];

    REMOTE_ENTITY_CREATE, // [ SHARED_ID: uint8, instance_id: uint16]
    REMOTE_ENTITY_VARIABLE_CHANGE, // [ SHARED_ID: uint8, instance id: uint16, ...data]

    REMOTE_FUNCTION_CALL, // [shared function id: uint8, ...function argument data]

    // x y and is your respawn point, level is value that points to level string
    
    START_ROUND, // [x:float32, y: float32, level_enum: uint8]

    // Player created if entity not found
    // PLAYER_CREATE --> sent to each player to make the create a new player object
    PLAYER_CREATE, // [playerID: uint8, entityID, x: float32, y: float32]

    PLAYER_POSITION, // [playerID: uint8, entityID, x: float32, y: float32, uint8: animationstate, bool: flipped, health: uint8];

    PLAYER_DESTROY, // [playerID: uint8, entityID]

    DAMAGE_PLAYER, // [dmg: uint8] damages the local client

    // TODO: EXPLOSION: [fromPlayer: uint8, x: float32, y: float32, strength: uint8] // handle knockback on clients

    PASSTHROUGH_TERRAIN_CARVE_CIRCLE, // [playerWhoDidIt: uint8, x: double, y: double, r: int32]
}



export enum ServerPacketSubType {
    IMMEDIATE, // not queue, reacted to immediately
    QUEUE // points to ServerBoundPacket
}

export enum ServerImmediatePacket {
    PING, // [timestamp: BigInt64]
}

export enum ServerBoundPacket {
    JOIN_GAME, // [empty packet]
    LEAVE_GAME, // [empty packet]

    PLAYER_POSITION, // [x: float32, y: float32, uint8: animationstate, bool: flipped, health: uint8]

    DAMAGE_OTHER_PLAYER, // [otherPlayerID: uint8, dmg: uint8]

    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]
}





