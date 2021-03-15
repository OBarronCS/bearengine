import { EntityID } from "shared/core/abstractentity";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { BufferStreamWriter } from "shared/datastructures/networkstream";
import { PlayerEntity } from "../serverentity";



export interface PacketWriter {
    write(stream: BufferStreamWriter): void,
}

