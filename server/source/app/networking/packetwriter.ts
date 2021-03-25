import { BufferStreamWriter } from "shared/datastructures/networkstream";

export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
}

