import { ClientBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamReader } from "shared/datastructures/networkstream";


export interface PacketHandler {
    packetType: ClientBoundPacket;
    read(frame: number, stream: BufferStreamReader): void;
}






