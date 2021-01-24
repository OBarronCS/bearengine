

// Types of entity packets
export enum ClientBoundPacket {
    PONG = 0, // response to client ping
    INIT, // tick_rate, reference tick and time
    START_TICKING, // tick_number

    // Everything below here depends on game
    GAME_STATE_PACKET // points to GameStatePacket

}

export enum GameStatePacket {
    SIMPLE_POSITION
}


export enum ServerBoundPacket {
    PING = 0,
    PLAYER_POSITION,
}





