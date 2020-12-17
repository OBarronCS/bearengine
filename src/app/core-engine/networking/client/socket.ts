
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

export class BufferedNetwork extends Network {

    private packets = new LinkedQueue<BufferedPacket>();

    public SERVER_SEND_RATE: number = -1;
    /** seconds, 1 / SERVER_SEND_RATE */
    public SERVER_SEND_INTERVAL: number = -1; //    1 / SERVER_SEND_RATE

    // These are used to calculate the current tick the server is sending
    // Sent in INIT packet
    public REFERENCE_SERVER_TICK_ID: number = 0;
    public REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds */
    public CLOCK_DELTA = 0;

    // How much buffer caused by latency
    private latencyBuffer: number = -1;
    
    // Buffer by default
    // MAYBE: Change this to big in terms of ms? Because if tick rate is slow (10fps) than this only really needs to be 1, because clumping is less of an issue
    private additionalBuffer = 3;

    // Generous, default ping
    // TODO: set it to -1 and don't start ticking until we actually know it. Right now it starts ticking and then 100ms seconds later the ping is adjusted
    public ping: number = 150;

    // Used if join a game, and its a lobby phase where the server is not sending real data. Or if server sends a message that says its DONE
    // TODO: implement failsafes so if the connecting abrubtly ends, we don't get errors in devtools, and instead notify the game engine that we are no longer connected.
    public SERVER_IS_TICKING: boolean = false;

    onopen(): void {
        this.sendPing();

        setInterval(() => {
            this.sendPing();
        }, 2000)
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
    }

    private initInfo(view: DataView){
        //
        // [ 8bit id, 8bit rate, 64 bit timestamp, 16 bit id]
        const rate = view.getUint8(1);
        this.SERVER_SEND_RATE = rate;
        this.SERVER_SEND_INTERVAL = (1/rate);

        // These may desync over time. Maybe resend them every now and then if it becomes an issue?
        this.REFERENCE_SERVER_TICK_TIME = view.getBigUint64(2);
        this.REFERENCE_SERVER_TICK_ID = view.getInt16(10)
    }

    private prepareTicking(view: DataView){
        // 1rst byte is 2
        // 2 and 3rd byte are 16 bit ID of 
        this.SERVER_IS_TICKING = true;
        // console.log(view)
        // this is the next tick that will be sent
        // this.currentServerSendID = view.getUint16(1);
    }

    private processGameData(view: DataView){
        const id = view.getUint16(1);

        // console.log("Received: " + id)
        this.packets.enqueue({ id: id, buffer: view.buffer });
        // console.log("Size of queue: " + this.packets.size())
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

    private lastConfirmedPacketFromBuffer = 0;

    // Get ping, 
    private calculatePing(view: DataView){
        // first byte: 1
        // next 8 bytes: the unix timestamp I sent
        // next 8 bytes: server time stamp

    
        
        const originalStamp = view.getBigInt64(1);
        const serverStamp = view.getBigInt64(9);

        const currentTime = BigInt(Date.now());
        this.ping = ceil(Number((currentTime - originalStamp)) / 2);

        console.log("Ping:" + this.ping);

        this.latencyBuffer = ceil((this.ping / 1000) * this.SERVER_SEND_RATE);
        console.log("LatencyBuffer: " + this.latencyBuffer)

    
        // This method assume latency is equal both ways
        const delta = serverStamp - currentTime + BigInt(this.ping);

        // LOCAL TIME + CLOCK_DELTA === TIME_ON_SERVER

        this.CLOCK_DELTA = Number(delta);

        /*
        ONE HUGE ISSUE HERE:
            If we are constantly re-adjusting ping (it will flucuate)
            than the buffer will constantly also move forward/backwards one frame and cause noticable jitter for one frame
            This might become an issue. If so, calculate ping over many frames and take average, and 
        */


    }

    public tick(){

        if(this.SERVER_IS_TICKING && this.ping !== -1){

            // ms
            const serverTime = Date.now() + this.CLOCK_DELTA;
            const referenceDelta = BigInt(serverTime) - this.REFERENCE_SERVER_TICK_TIME;

            // console.log("Ticks passed: " + (referenceDelta / BigInt((this.SERVER_SEND_INTERVAL * 1000))));

            // This uses BigInt, division is floored
            const currentServerTick =  ((referenceDelta / BigInt((this.SERVER_SEND_INTERVAL * 1000)))) + BigInt(this.REFERENCE_SERVER_TICK_ID)

            const frameToGet = Number(currentServerTick) - (this.latencyBuffer + this.additionalBuffer);
            
            // New frame!
            // TODO: make a check to make sure it doesn't go back in time? 
            // Implement some sort of pause at very beginning of game, so it waits to start look at packets like .5 seconds after the first recieved packet.
            // , and when the latency is adjusted backwards, so that it 
            if(frameToGet !== this.lastConfirmedPacketFromBuffer){
                console.log(Date.now())
                console.log("Getting frame: " + frameToGet)
                
                //Attempt to get this frame out of the buffer
                // First, delete all old frames
                while(this.packets.size() > 0 && frameToGet > this.packets.peek().id){
                    const oldPacket = this.packets.dequeue();
                    console.log("Old packet discarded: " + oldPacket.id)
                }

                if(this.packets.size() === 0){
                    // In this case, we are asking for a frame that we don't have yet
                    console.log("ERROR: ASKING FOR FRAME WE DO NOT HAVE: " + frameToGet);
                    
///////////////////////////// // * !ASIGAKUSVAJYSFAKUSC JACFSAJFSCAJSCJASC 0?
                    // get rid of this return statement
                    return; 
                }

                // Okay so we are not too far in the future.
                // Might be too far in the past though, ( ex: start of game, only one buffered but its in future)
                if(frameToGet < this.packets.peek().id){
                    console.log("We are too far in the future")
                    return;
                }
                
                // This is the one!
                const packet = this.packets.dequeue();
                const buffer = packet.buffer;
                console.log("Confirmed: " + packet.id)

                console.log("Number of buffer frames: " + this.packets.size());


                this.lastConfirmedPacketFromBuffer = frameToGet;

                return buffer;
            }
        }
    }
}








