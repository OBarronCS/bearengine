
// Encapsulates connections to players

import WS from "ws"
import { BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket } from "shared/core/sharedlogic/packetdefinitions";


export class ServerNetwork {
    private readonly TICK_RATE: number;
    private readonly port: number;

    protected socket: WS.Server = null;
    
    public referenceTime: bigint = 0n;
    public referenceTick = 0;

    public tick = 0;

    // List of connections
    protected sockets: WS[] = []


    constructor(tickRate:number, port: number){
        this.TICK_RATE = tickRate;
        this.port = port;
    }

    public start(){
        this.socket = new WS.Server( { port:this.port } )
        this.socket.on("connection", this.sendStartData.bind(this));

        this.socket.on("close", () => {
            console.log("Disconected")
        });
    }

    sendStartData(socket: WS){
        console.log("New connection")
        this.sockets.push(socket);
    
        socket.binaryType = "arraybuffer";

        // INIT DATA. 
        const init_writer = new BufferStreamWriter(new ArrayBuffer(12))
        init_writer.setUint8(ClientBoundPacket.INIT);

        init_writer.setUint8(this.TICK_RATE)
        init_writer.setBigUint64(this.referenceTime);
        init_writer.setInt16(this.referenceTick);
        socket.send(init_writer.getBuffer());
    

        // START TICKING
        const start_tick_writer = new BufferStreamWriter(new ArrayBuffer(3))
        start_tick_writer.setUint8(ClientBoundPacket.START_TICKING);
        
        start_tick_writer.setUint16(this.tick);
        socket.send(start_tick_writer.getBuffer())


    
        socket.on('message', (data) => {   
            // Assumes all messages are ping for now   
    
            // Copies the data over
            const finalBuffer = new Uint8Array(new ArrayBuffer(17));
            finalBuffer.set(new Uint8Array(data as ArrayBuffer));
    
            const view = new DataView(finalBuffer.buffer);
            const now = BigInt(Date.now());
            view.setBigInt64(9, now)
    
            socket.send(view)
        })
    }

    onmessage(socket: WS ,ev: MessageEvent<any>): void {

    }

    writePacketStateData(stream: BufferStreamWriter){
        stream.setUint8(3);
        stream.setUint16(this.tick);
    }

    sendGameData(buffer: ArrayBuffer | ArrayBufferView, time: number){
        this.referenceTime = BigInt(time);
        this.referenceTick = this.tick;
        
        // console.log(this.tick)

        this.broadcast(buffer);

        this.tick++;
    }

    public broadcast(buffer: ArrayBuffer | ArrayBufferView){
        this.sockets.forEach((client) => {
            // if (client.readyState === WebSocket.OPEN)
            client.send(buffer);
            
        }) 
    }

    public disconnect(){
        this.socket.close();
    }
}


