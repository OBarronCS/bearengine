/*
    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, Receiving buffers
*/

import { LinkedQueue } from "shared/datastructures/queue";
import { BufferStreamReader } from "shared/datastructures/bufferstream";
import { ClientBoundImmediate, ClientBoundSubType } from "shared/core/sharedlogic/packetdefinitions";
import { AssertUnreachable } from "shared/assertstatements";


interface NetworkSettings {
    port: number,
    url?: string,
}

export abstract class Network {

    protected socket: WebSocket = null;
    private url: string;

    public CONNECTED: boolean = false;

    /*
    Options to create:
        local,
            ws://127.0.0.1:{port}
            still need to specify port
        not local:
            wss://{ip}
            ip:
                could be same as html server
                could be different
            port: 
                need to specify. Could be same as
                
    Use location.protocol:
        http, ws: for local
        https, wss: for outside
    */
    constructor(settings: NetworkSettings){
        // Auto-detect url 
        const protocol = window.location.protocol;
    
        if(protocol !== "http:" && protocol !== "https:"){
            throw new Error(`Unknown protocol: ${protocol}. How did this happen`);
        }

        // if http, its probably going to be ws as well (local dev server)
        const ws_protocol = protocol === "http:" ? "ws": "wss";
        
        const ip = settings.url === undefined ? location.hostname : settings.url;

        const url = `${ws_protocol}://${ip}:${settings.port}`;

        console.log(`Websocket url: ${url}`);

        this.url = url;
    }

    public connect(){
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
            console.log("Socket connected");
            this.CONNECTED = true;
            this.onopen();
        }

        this.socket.onclose = () => {
            console.log("Socket closed");
            this.CONNECTED = false;
            // this.socket.close() will initiate closing on client side, and will go into closing state (2)
            // this is not the case here but may be helpful in the future
            // At this point, socket is in state "3", closed. 
            this.onclose();
        }

        // The bind is crucial here, otherwise this would refer to the socket
        this.socket.onmessage = this.onmessage.bind(this);
    }

    abstract onopen(): void;
    abstract onclose(): void;
    abstract onmessage(ev: MessageEvent<any>): void;

    public send(buffer: ArrayBuffer | ArrayBufferView){
        this.socket.send(buffer);
    }

    public disconnect(){
        this.socket.close();
    }
}

interface BufferedPacket {
    buffer: BufferStreamReader;
    id: number;
}

export class BufferedNetwork extends Network {

    private packets = new LinkedQueue<BufferedPacket>();

    getNewPacketQueue(){ return this.packets; }

    onclose(): void {}
    onopen(): void {
        console.log("Buffered network connected");
    }

    pongcallback: (stream: BufferStreamReader) => void = null;

    onmessage(ev: MessageEvent<any>): void {
        const stream = new BufferStreamReader(ev.data);

        const subtype: ClientBoundSubType = stream.getUint8();

        switch(subtype){
            case ClientBoundSubType.IMMEDIATE: {

                const immediate: ClientBoundImmediate = stream.getUint8();

                switch(immediate){
                    case ClientBoundImmediate.PONG: {
                        if(this.pongcallback !== null){
                            this.pongcallback(stream);
                        }
                        break;
                    }
                    default: AssertUnreachable(immediate);
                }
                break;
            }
            case ClientBoundSubType.QUEUE: {
                // Starts with Tick number, then jumps straight into subpackets
                const id = stream.getUint16();
                // console.log("Received: " + id)
                this.packets.enqueue({ id: id, buffer: stream });
                // console.log("Size of queue: " + this.packets.size()) 

                break;
            }
            default: AssertUnreachable(subtype);
        }
    }
}








