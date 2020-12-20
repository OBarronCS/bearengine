import { BufferStreamReader } from "shared/datastructures/networkstream";




export abstract class PacketHandler {

    abstract read(stream: BufferStreamReader): void;
}






