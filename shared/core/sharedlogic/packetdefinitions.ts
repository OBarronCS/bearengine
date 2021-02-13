

/// Rename these

// Types of entity packets
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
}



export enum ServerBoundPacket {
    PING = 0,
    CLIENT_STATE_PACKET // envelopes ClientStatePacket's
}

// Server Bound
export enum ClientPacket {
    JOIN_GAME = 0, // used internall
    PLAYER_POSITION
}





