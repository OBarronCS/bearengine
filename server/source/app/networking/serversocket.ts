
// Encapsulates connections to players

import WS from "ws"
import { BufferStreamWriter } from "shared/datastructures/networkstream"


export class ServerNetwork {
    private readonly TICK_RATE: number;

    protected socket: WS.Server = null;
    
    public referenceTime: bigint = 0n;
    public referenceTick = 0;

    public tick = 0;

    // List of connections
    protected sockets: WS[] = []

    private port: number;

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

        // Sends start data. 
        // TICK_RATE, and reference tick data
        const buffer = new ArrayBuffer(12);
        const initInfo = new DataView(buffer);
        initInfo.setUint8(0,1);
        initInfo.setUint8(1, this.TICK_RATE)
        initInfo.setBigUint64(2,this.referenceTime);
        initInfo.setInt16(10,this.referenceTick);
    
        socket.send(initInfo.buffer);
    
        const buffer2 = new ArrayBuffer(3);
        const prepareTicking = new DataView(buffer2);
        prepareTicking.setUint8(0,2);
        prepareTicking.setUint16(1,this.tick);
        
        socket.send(prepareTicking.buffer)
    
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


