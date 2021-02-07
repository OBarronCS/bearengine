
/*
    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, Receiving buffers
*/

import { abs, ceil } from "shared/miscmath";
import { LinkedQueue } from "shared/datastructures/queue";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
 
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
    buffer: BufferStreamReader;
    id: number;
}

export class BufferedNetwork extends Network {

    private packets = new LinkedQueue<BufferedPacket>();

    public SERVER_SEND_RATE: number = -1;
    /** seconds, 1 / SERVER_SEND_RATE */
    public SERVER_SEND_INTERVAL: number = -1; 

    // These are used to calculate the current tick the server is sending
    // Sent in INIT packet
    public REFERENCE_SERVER_TICK_ID: number = 0;
    public REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds, adjusted on ping packets */
    public CLOCK_DELTA = 0;

    // How much buffer caused by latency
    // TODO: don't actually have this be a set numbre of packets, but a time in ms
    private latencyBuffer: number = -1;
    
    // Buffer by default
    // TODO: Change this to big in terms of ms? Because if tick rate is slow (10fps) than this only really needs to be 1, because clumping is less of an issue
    private additionalBuffer = 2;

    // Generous, default ping
    // TODO: set it to -1 and don't start ticking until we actually know it. Right now it starts ticking and then some time later the ping is adjusted
    public ping: number = 150;

    // Used if join a game, and its a lobby phase where the server is not sending real data. Or if server sends a message that says its DONE
    // TODO: implement failsafes so if the connecting abrubtly ends, we don't get errors in devtools, and instead notify the game engine that we are no longer connected.
    public SERVER_IS_TICKING: boolean = false;


    constructor(url: string){
        super(url);
    }

    onopen(): void {
        this.sendPing();

        setInterval(() => {
            this.sendPing();
        }, 2000)
    }

    onclose(): void {}

    onmessage(ev: MessageEvent<any>): void {
        const stream = new BufferStreamReader(ev.data);

        const type = stream.getUint8();
        switch(type){
            case ClientBoundPacket.PONG: this.calculatePing(stream); break;
            case ClientBoundPacket.INIT: this.initInfo(stream); break;
            case ClientBoundPacket.START_TICKING: this.prepareTicking(stream); break;
            case ClientBoundPacket.GAME_STATE_PACKET: this.processGameData(stream); break;
            
            default: console.log("Unknown data from server"); break;
        }
    }

    private initInfo(stream: BufferStreamReader){
        // [ 8 bit rate, 64 bit timestamp, 16 bit id ]
        const rate = stream.getUint8();
        this.SERVER_SEND_RATE = rate;
        this.SERVER_SEND_INTERVAL = (1/rate);

        // These may desync over time. Maybe resend them every now and then if it becomes an issue?
        this.REFERENCE_SERVER_TICK_TIME = stream.getBigUint64();
        this.REFERENCE_SERVER_TICK_ID = stream.getUint16();
    }

    private prepareTicking(stream: BufferStreamReader){
        this.SERVER_IS_TICKING = true;
        // next 16 bits are the tick
    }

    private processGameData(stream: BufferStreamReader){
        const id = stream.getUint16();
        // console.log("Received: " + id)
        this.packets.enqueue({ id: id, buffer: stream });
        // console.log("Size of queue: " + this.packets.size())
    }

    public sendPing(){
        // Unix time stamp in ms needs 64 bits
        const stream = new BufferStreamWriter(new ArrayBuffer(9));

        stream.setUint8(ServerBoundPacket.PING);
        stream.setBigInt64(BigInt(Date.now()));

        this.socket.send(stream.getBuffer());
    }
 
    private calculatePing(stream: BufferStreamReader){
        // next 8 bytes: the unix timestamp I sent
        // next 8 bytes: server time stamp
    
        const originalStamp = stream.getBigInt64();
        const serverStamp = stream.getBigInt64();

        const currentTime = BigInt(Date.now());

        const pingThisTime = ceil(Number((currentTime - originalStamp)) / 2);
        
        //TODO: implement some sort of smoothing of the ping. Sample it multiple times
        // only adjust the ping if it has changed sufficintely 
        if(abs(this.ping - pingThisTime) > 4){
            this.ping = pingThisTime;
        }

        console.log("Ping:" + this.ping);

        this.latencyBuffer = ceil((this.ping / 1000) * this.SERVER_SEND_RATE);
        console.log("LatencyBuffer: " + this.latencyBuffer)

    
        // This method assumes latency is equal both ways
        const delta = serverStamp - currentTime + BigInt(this.ping);

        // LOCAL TIME + CLOCK_DELTA === TIME_ON_SERVER

        this.CLOCK_DELTA = Number(delta);

        /*
        ONE HUGE ISSUE HERE:
            If we are constantly re-adjusting ping (it will flucuate)
            than the buffer will constantly move forward/backwards one frame and cause noticable jitter for one frame
            This might become an issue. If so, calculate ping over many frames and take average, and 
        */
    }

    public tickToSimulate(): number {
        const serverTime = Date.now() + this.CLOCK_DELTA;
        const referenceDelta = serverTime - Number(this.REFERENCE_SERVER_TICK_TIME);

        const currentServerTick =  ((referenceDelta / (this.SERVER_SEND_INTERVAL * 1000))) + this.REFERENCE_SERVER_TICK_ID
        
        // console.log(currentServerTick);
        
        // Includes fractional part of tick
        const frameToGet = currentServerTick - (this.latencyBuffer + this.additionalBuffer);
        
        return frameToGet;
    }

    newPacketQueue(){
        return this.packets;
    }

    private lastConfirmedPacketFromBuffer = 0;

    public tick(): BufferStreamReader | null {
        throw new Error("Don't call this method");
        return null;


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
                    return null; 
                }

                // Okay so we are not too far in the future.
                // Might be too far in the past though, ( ex: start of game, only one buffered but its in future)
                if(frameToGet < this.packets.peek().id){
                    console.log("We are too far in the future")
                    return null;
                }
                
                // This is the one!
                const packet = this.packets.dequeue();

                const stream = packet.buffer;


                // console.log(stream.getBuffer())
                console.log("Got frame: " + packet.id)
                console.log("Number of buffer frames: " + this.packets.size());

                this.lastConfirmedPacketFromBuffer = frameToGet;


                return stream;
            }
        }

        return null;
    }

}








