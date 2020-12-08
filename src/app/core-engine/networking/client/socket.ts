
/*

    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, 
        Recieving buffers
*/

import { ceil } from "../../../math-library/miscmath";
import { LinkedQueue } from "../../../math-library/queue";



export abstract class Network {

    protected socket: WebSocket = null;
    private url: string;

    constructor(url: string){
        this.url = url;
    }

    public connect(){
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
            console.log("Socket connected");
            this.onopen();
        }

        this.socket.onclose = () => {
            console.log("Disconected")
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
    buffer: ArrayBuffer;
    id: number;
}

//instead of calling callback immediately, buffer it for a moment
//this means that main game loop needs to tick this up to hold internal timer
export class BufferedNetwork extends Network {

    private packets = new LinkedQueue<BufferedPacket>();

    public SERVER_SEND_RATE: number = -1;
    public SERVER_SEND_INTERVAL: number = -1; //    1 / SERVER_SEND_RATE

    public intervalTimer: number = 0; // Keep track of time, reset to zero on packets
    public currentServerSendID: number = 0; // The packet being sent by server right now, estimate

    /*
    N depends on latency
        N should be AT LEAST ceiling(ping / ms per server send data)
        Same as ceiling(ping * SERVER_SEND_RATE)
    
    So server sends data every 50 ms (20 serversend_rate).  ping = 200 ms
    N should be at least 4. Add one or two to this.
    */
    private latencyBuffer: number = -1;
    private additionalBuffer = 3;

    public ping: number = -1;

    public SERVER_IS_TICKING: boolean = false;

    onopen(): void {
        this.sendPing();
    }

    onclose(): void {}

    onmessage(ev: MessageEvent<any>): void {
        //const reader = new BufferReaderStream(ev.data);
        /* 
        Types of packets:
            Init packets, send server rate and other info
            Game data
            
        Read first byte:
            0 its a pong, response to client ping
            1 its init packet
            2 prepare for ticking
            3 data
        */
       
        const view = new DataView(ev.data);
        switch(view.getUint8(0)){
            case 0: this.calculatePing(view); break;
            case 1: this.initInfo(view); break;
            case 2: this.prepareTicking(view); break;
            case 3: this.processGameData(view); break;
        }

        this.packets.enqueue(ev.data);
    }

    private initInfo(view: DataView){
        const rate = view.getUint8(1);
        this.SERVER_SEND_RATE = rate;
        this.SERVER_SEND_INTERVAL = (1/rate);

    }

    private prepareTicking(view: DataView){
        // 1rst byte is 2
        // 2 and 3rd byte are 16 bit ID of 
        this.SERVER_IS_TICKING = true;
        // console.log(view)
        // this is the next tick that will be sent
        this.currentServerSendID = view.getUint16(1);
    }

    private processGameData(view: DataView){
        const id = view.getInt16(1);

        console.log("Received: " + id)
        //this.packets.enqueue({ id: id, buffer: view.buffer });
    }

    public sendPing(){
        // Unix time stamp in ms needs 64 bits
        const buffer = new ArrayBuffer(9);
        const view = new DataView(buffer);

        view.setUint8(0,0);

        const now = Date.now()
        view.setBigInt64(1, BigInt(now))

        this.socket.send(view)
    }

    private calculatePing(view: DataView){
        // first byte: 1
        // next 8 bytes: the unix timestamp I sent
        // next 8 bytes: server time stamp
        
        const originalStamp = view.getBigInt64(1);
        const serverStamp = view.getBigInt64(9);

        this.ping = Number(BigInt(Date.now()) - originalStamp);


        this.latencyBuffer = ceil((this.ping / 1000) * this.SERVER_SEND_RATE);
        console.log("LatencyBuffer: " + this.latencyBuffer)
    }

    public tick(delta: number){
        // Don't do this based on delta... right?
        if(this.SERVER_IS_TICKING && this.ping !== -1){
            this.intervalTimer += delta;

            while(this.intervalTimer >= this.SERVER_SEND_INTERVAL){
                console.log(this.intervalTimer);
                this.currentServerSendID += 1;

                this.requestPacket(this.currentServerSendID - (this.latencyBuffer + this.additionalBuffer));

                this.intervalTimer -= this.SERVER_SEND_INTERVAL
            }   
        }
    }


    public requestPacket(id: number){
        console.log(id);
        return;
        while(id > this.packets.peek().id){
            this.packets.dequeue();
        }

        
        
        let buffer: ArrayBuffer;
        if(this.packets.peek().id === id){
            const packet = this.packets.dequeue();
            console.log("Found packet: " + packet.id);
        } else {
            // We couldn't find the packet. Either too small or large id
            // Just an error overall
            console.log()
        }

        return buffer;
    }

}








