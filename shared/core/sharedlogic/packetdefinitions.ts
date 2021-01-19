

// Types of entity packets
export enum ClientBoundPacket {
    PONG = 0, // response to client ping
    INIT, // tick_rate, reference tick and time
    START_TICKING, // tick_number

    // Everything below here depends on game
    SIMPLE_POSITION,

}



