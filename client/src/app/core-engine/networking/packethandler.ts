import { GameStatePacket } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamReader } from "shared/datastructures/networkstream";


export interface PacketHandler {
    packetType: GameStatePacket;
    read(frame: number, stream: BufferStreamReader): void;
}


