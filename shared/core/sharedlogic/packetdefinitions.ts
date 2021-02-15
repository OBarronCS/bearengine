
export enum ClientBoundPacket {
    PONG = 0, // response to client ping
    INIT, // tick_rate, reference tick and time
    START_TICKING, // tick_number

    // Everything below here depends on game
    GAME_STATE_PACKET // points to GamePacket
}

export enum GamePacket {
    SIMPLE_POSITION,
    PLAYER_POSITION,
    ENTITY_DESTROY, // used with players right now 
}



export enum ServerBoundPacket {
    PING = 0,
    CLIENT_STATE_PACKET // envelopes ClienPacket's
}

// Server Bound, think of better name

// Make sure to recompile client after changing these, or else
// everything will break and the bug will be impossible to track down
// because it's enum values wouldn't have changed, leading to it thinking its sending a different packet
// than it really is
export enum ClientPacket {
    JOIN_GAME = 0, // used internally
    LEAVE_GAME, // internally
    PLAYER_POSITION
}





