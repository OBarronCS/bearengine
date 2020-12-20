import { PacketID } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamReader } from "shared/datastructures/networkstream";


export interface PacketHandler {
    packetType: PacketID;
    read(stream: BufferStreamReader): void;
}






