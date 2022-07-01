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

    // PERSONAL PACKET
    // If true, set state to GHOST, so stops transmitting position. Used when your player dies
    // If false set to active, allowing you to transmit position
    SET_GHOST_STATUS, // [ghost: boolean]

    //Personal packet.
    //    load level data, set personal x, y;
    START_ROUND, // [x:float32, y:float32, level_enum: uint8, seconds_until_start: double]
    
    // Array of players in order of winner, to last place
    END_ROUND, // [ticks_until_next_round: uint16, array_length: uint8, [clientID: uint8] * array_length] 

    DECLARE_COMMANDS, // [Array<CommandHintFormat>]

    LOAD_LEVEL, // [level_enum: uint8]


    CLEAR_INV_ITEM, // []
    SET_INV_ITEM, // [ItemID: uint8,...data]

    // Notifying clients about other clients connected to the server
    OTHER_PLAYER_INFO_ADD, //      [unique_client_id: uint8, ping: uint16, gamemode: ClientPlayState] // add string to this one day
    OTHER_PLAYER_INFO_PING, //     [unique_client_id: uint8, ping: uint16]
    OTHER_PLAYER_INFO_GAMEMODE, // [unique_client_id: uint8, gamemode: ClientPlayState]
    OTHER_PLAYER_INFO_REMOVE, //   [unique_client_id: uint8]


    // Commands to create/change state of OTHER players.
    // Spawn creates an entity. Places it at given location if exists --> Used to deghost
    PLAYER_ENTITY_SPAWN, // [playerID: uint8, x: float32, y: float32]
    PLAYER_ENTITY_POSITION, // [playerID: uint8, x: float32, y: float32, look_dir: Vec2(float), uint8: animationstate, bool: flipped];
    PLAYER_ENTITY_DEATH, // [playerID: uint8]
    PLAYER_ENTITY_COMPLETELY_DELETE, // [playerID: uint8]
    PLAYER_ENTITY_SET_ITEM, // [player_id: uint8, ItemID: uint8]
    PLAYER_ENTITY_CLEAR_ITEM, // [player_id: uint8]
    
    // DO NOT IGNORE THIS PACKET, contains clients health too
    PLAYER_ENTITY_TAKE_DAMAGE, // [player_id: uint8, new_health: uint8, dmg: uint8]

    // TODO: EXPLOSION_JUICE: [x: float32, y: float32, knockback_vector: Vec2<float>] // handle knockback on clients

    // Personal packet, teleports your player to this position
    FORCE_POSITION, // [x: float32, y: float32]

    // Personal packet
    CONFIRM_VOTE, // [mode: MatchGamemode, enabled: bool]
        
    TERRAIN_CARVE_CIRCLE, // [x: double, y: double, r: int32]


    // Many items will use this packet to communicate their actions
    GENERAL_DO_ITEM_ACTION, // [creator_id: uint8, ItemActionType: uint8_enum, createServerTick: float32, x: float32, y: float32, ...extra_data]

    // Personal packet, response to REQUEST_ITEM_ACTION
    ACKNOWLEDGE_ITEM_ACTION, // NOT IMPLEMENTED [ItemActionType: uint8_enum, ItemActionAck: uint8_enum, clientside_action_id: uint32, , ...data];


    NEW_CLIENT_DO_ITEM_ACTION, // [creator_id: uint8, SharedActionID: uint8, create_server_tick: float32, ...data_depending_on_action_id]
    NEW_ACK_ITEM_ACTION, // [SharedActionID: uint8_enum, ItemActionAck: uint8_enum, create_server_tick: float32, clientside_action_id: uint32, , ...data_depending_on_action_id]


}

/*
ITEM ACTION EXTRA DATA DEFINITIONS:
// CLIENTBOUND
    BEAM, [BeamActionType]


// SERVERBOUND
    BEAM, [BeamActionType]
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


    NEW_AUTO_REQUEST_ITEM_ACTION, // [SharedItemActionID: uint8, local_action_id: uint32, ...custom_data_depending_on_id]


    REQUEST_CHAT_MESSAGE, // [ShortString (255 chars max), ]
}





