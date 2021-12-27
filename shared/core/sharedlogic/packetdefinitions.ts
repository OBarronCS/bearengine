// Remember to recompile client after changing these, or else
// everything will break and the bug will be impossible to track down

export enum ClientBoundSubType {
    IMMEDIATE, // points to ClientBoundImmediate
    QUEUE, // points to GamePacket
}

export enum ClientBoundImmediate {
    PONG, // [ original stamp: BigInt64, server stamp: BigInt64]
}

//REMOTE_ENTITY_VARIABLE_DATA = [SHARED_ID: uint8, entityID, dirty_bits: uint32, ...[position: Vec2<float32>?]...data]

export enum GamePacket {
    INIT, // [ hash: uint64, tick_rate: uint8, reference time: biguint64, tick: uint16, uint8: your_player_id] 
    SERVER_IS_TICKING, // [tick: uint16];

    REMOTE_ENTITY_CREATE, // [ SHARED_ID: uint8, entityID]
    REMOTE_ENTITY_VARIABLE_CHANGE, // REMOTE_ENTITY_VARIABLE_DATA;
    REMOTE_ENTITY_EVENT, // [SHARED_ID: uint8, entityID, EVENT_ID: uint8][...data];
    REMOTE_ENTITY_DELETE, // [SHARED_ID: uint8, entityID]


    REMOTE_FUNCTION_CALL, // [shared function id: uint8, ...function argument data]

    // Personal Packet
    // Sets client state to ACTIVE, which allows client to send position packets for player
    SPAWN_YOUR_PLAYER_ENTITY, // [x: float32, y: float32]

    // If true, set client state to GHOST. If false set to active
    SET_GHOST_STATUS, // [ghost: boolean]

    //Personal packet.
    //    load level data, set personal x, y;
    START_ROUND, // [x:float32, y:float32, level_enum: uint8]
    
    // Array of players in order of winner, to last place
    END_ROUND, // [ array_length: uint8, [clientID: uint8] * array_length] 

    DECLARE_COMMANDS, // [Array<CommandHintFormat>]

    // If client joins will game is active, this packet is sent to them
    JOIN_LATE_INFO, // [level_enum: uint8]


    CLEAR_INV_ITEM, // []
    SET_INV_ITEM, // [ItemID: uint8,...data]

    // Notifying clients about other clients connected to the server
    OTHER_PLAYER_INFO_ADD, //      [unique_client_id: uint8, ping: uint16, gamemode: ClientPlayState] // add string to this one day
    OTHER_PLAYER_INFO_PING, //     [unique_client_id: uint8, ping: uint16]
    OTHER_PLAYER_INFO_GAMEMODE, // [unique_client_id: uint8, gamemode: ClientPlayState]
    OTHER_PLAYER_INFO_REMOVE, //   [unique_client_id: uint8]


    // Commands to create/change state of OTHER players.
    // Client must ignore if ID === localID; 
    // spawn creates an entity. Places it at given location --> Used to deghost
    PLAYER_ENTITY_SPAWN, // [playerID: uint8, x: float32, y: float32]
    PLAYER_ENTITY_POSITION, // [playerID: uint8, x: float32, y: float32, look_dir: Vec2(float), uint8: animationstate, bool: flipped, health: uint8];
    PLAYER_ENTITY_GHOST, // [playerID: uint8]
    PLAYER_ENTITY_COMPLETELY_DELETE, // [playerID: uint8]
    
    PLAYER_ENTITY_SET_ITEM, // [player_id: uint8, ItemID: uint8]
    PLAYER_ENTITY_CLEAR_ITEM, // [player_id: uint8]

    // TODO: EXPLOSION: [fromPlayer: uint8, x: float32, y: float32, strength: uint8] // handle knockback on clients

    // Teleports your player to this position
    FORCE_POSITION, // [x: float32, y: float32]

        
    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]


    // Many items will use this packet to communicate their actions
    GENERAL_DO_ITEM_ACTION, // [creator_id: uint8, ItemActionType: uint8_enum, createServerTick: float32, x: float32, y: float32, ...extra_data]

    // Personal packet, response to REQUEST_ITEM_ACTION
    ACKNOWLEDGE_ITEM_ACTION, // NOT IMPLEMENTED [ItemActionType: uint8_enum, ItemActionAck: uint8_enum, clientside_action_id: uint32, , ...data];
}

/*
ITEM ACTION EXTRA DATA DEFINITIONS:
// CLIENTBOUND
    PROJECTILE_SHOT: [dir_x: float32, dir_y: float32, shot_prefab_id:uint8, entityIDofBullet];
    HIT_SCAN: [end_x: float32, end_y: float32];
    FORCE_FIELD: [], // NEVER CALLED



// SERVERBOUND
    PROJECTILE_SHOT: [dir_x: float32, dir_y: float32];
    HIT_SCAN: [end_x: float32, end_y: float32];
    FORCE_FIELD: [],
    SHOTGUN_SHOT: [Array of count [clientside_bullet_id] for each bullet created]


*/


export enum ServerPacketSubType {
    IMMEDIATE, // not queue, reacted to immediately
    QUEUE // points to ServerBoundPacket
}

export enum ServerImmediatePacket {
    PING, // [timestamp: BigInt64]
}

export enum ServerBoundPacket {
    PLAYER_POSITION, // [x: float32, y: float32, mouse_x: float32, mouse_y: float32, uint8: animationstate, bool: flipped, isMouseDown: bool, isFDown: bool, isQDown: bool]


    REQUEST_ITEM_ACTION, // [ItemActionType: enum, local_action_id: uint32, createServerTick: float32, x: float32, y: float32, ...data]

    REQUEST_CHAT_MESSAGE, // [ShortString (255 chars max), ]
}





