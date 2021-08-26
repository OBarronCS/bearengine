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
    SERVER_IS_TICKING, // [tick: uint16];

    REMOTE_ENTITY_CREATE, // [ SHARED_ID: uint8, entityID]
    REMOTE_ENTITY_VARIABLE_CHANGE, // [ SHARED_ID: uint8, entityID, ...data];
    
    REMOTE_ENTITY_EVENT, // [SHARED_ID: uint8, entityID, EVENT_ID: uint8][...data];

    REMOTE_ENTITY_DELETE, // [SHARED_ID: uint8, entityID]


    REMOTE_FUNCTION_CALL, // [shared function id: uint8, ...function argument data]

    /*  
        This packets makes it so you create your player entity, and load level data
    
        x y and is your respawn point, level is value that points to level string
    */
    START_ROUND, // [x:float32, y:float32, level_enum: uint8]
    END_ROUND, // [] empty 



    CLEAR_INV_ITEM, // []
    SET_INV_ITEM, // [ItemID: uint8]

    // Notifying clients about other clients connected to the server
    OTHER_PLAYER_INFO_ADD, //      [unique_client_id: uint8, ping: uint16, gamemode: Gamemode] // add string to this one day
    OTHER_PLAYER_INFO_PING, //     [unique_client_id: uint8, ping: uint16]
    OTHER_PLAYER_INFO_GAMEMODE, // [unique_client_id: uint8, gamemode: Gamemode]
    OTHER_PLAYER_INFO_REMOVE, //   [unique_client_id: uint8]

    // command to create OTHER players 
    PLAYER_CREATE, // [playerID: uint8, x: float32, y: float32]

    PLAYER_POSITION, // [playerID: uint8, x: float32, y: float32, uint8: animationstate, bool: flipped, health: uint8];
    
    PLAYER_DESTROY, // [playerID: uint8]

    // TODO: EXPLOSION: [fromPlayer: uint8, x: float32, y: float32, strength: uint8] // handle knockback on clients

    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]


    SHOOT_WEAPON, // [creator_id: uint8, ITEM_ID_OF_WEAPON: uint8, serverShotID: uint32, createServerTick: float32, x: float32, y: float32, ...extra_data]

    ACKNOWLEDGE_SHOT // [success: bool, localShotID: uint32, serverShotID: uint32];
}

/*
SHOT EXTRA DATA DEFINITIONS:
    HITSCAN_WEAPON: [end_x: float32, end_y: float32];
    TERRAIN_CARVER: [velocity_x: float32, vel_y: float32];
*/


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


    PLAYER_POSITION, // [x: float32, y: float32, mouse_x: float32, mouse_y: float32, uint8: animationstate, bool: flipped, isMouseDown: bool, isFDown: bool, isQDown: bool]

    REQUEST_SHOOT_WEAPON, // [ITEM_ID_OF_WEAPON: uint8, localShootID: uint32, createServerTick: float32, x: float32, y: float32, ...data]
}





