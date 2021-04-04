/*
    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, Receiving buffers
*/

import { abs, ceil } from "shared/mathutils";
import { LinkedQueue } from "shared/datastructures/queue";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket, ClientPacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { AssertUnreachable } from "shared/assertstatements"


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

    public PLAYER_ID = -1;

    public SERVER_IS_TICKING: boolean = false;

    private packets = new LinkedQueue<BufferedPacket>();

    public SERVER_SEND_RATE: number = -1;
    /** seconds, 1 / SERVER_SEND_RATE */
    public SERVER_SEND_INTERVAL: number = -1; 

    // These are used to calculate the current tick the server is sending, received in INIT packet
    public REFERENCE_SERVER_TICK_ID: number = 0;
    public REFERENCE_SERVER_TICK_TIME: bigint = -1n;

    /** milliseconds, adjusted on ping packets */
    public CLOCK_DELTA = 0;

    // Generous, default ping
    // MAYBE: set it to -1 and don't start ticking until we actually know it. Right now it starts ticking and then some time later the ping is adjusted
    public ping: number = 100;
    
    /** 
     * MILLISECONDS,
     * Used to adjust the currentTick we should simulate, used for interpolation. In effect, hold onto info for this long before simulating them 
     * In practice, it combats jitter in packet receiving times (even though server sends at perfect interval, we don't receive them in that same perfect interval)
     * Experiment with making this lower, maybe even 50
    */
    private dejitterTime = 100;

    

    onopen(): void {
        console.log("Buffered network connected")

        const stream = new BufferStreamWriter(new ArrayBuffer(2))
        
        stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);

        stream.setUint8(ClientPacket.JOIN_GAME);

        this.send(stream.getBuffer());

        this.sendPing();

        // TODO: stop this from being in setInterval, put it into tick 
        // Possible issues: tick is run in rAF, which is not run if the tab is not in focus/view. Pinging still stop in those cases

        setInterval(() => {
            this.sendPing();
        }, 2000);
    }

    onclose(): void {}

    onmessage(ev: MessageEvent<any>): void {
        const stream = new BufferStreamReader(ev.data);

        while(stream.hasMoreData()){
            const type: ClientBoundPacket = stream.getUint8();

            // RIGHT NOW, IT ASSUMES THAT beginning packets are the other ClientBoundPackets, and last one is GAME_STATE_PACKET
            switch(type){
                case ClientBoundPacket.PONG: this.calculatePing(stream); break;
                case ClientBoundPacket.INIT: this.initInfo(stream); break;
                case ClientBoundPacket.START_TICKING: {
                    this.SERVER_IS_TICKING = true;
                
                    const tick = stream.getUint16(); // Reads this number so stream isn't broken

                    break;
                }
                case ClientBoundPacket.GAME_STATE_PACKET: { 
                    // Queues the data
                    
                    const id = stream.getUint16();
                    // console.log("Received: " + id)
                    this.packets.enqueue({ id: id, buffer: stream });
                    // console.log("Size of queue: " + this.packets.size()) 

                    return;
                }
                default: AssertUnreachable(type);
            }
        }
    }

    private initInfo(stream: BufferStreamReader){
        // [ tick_rate: uint8, reference time: biguint64, tick: uint16, uint8: your_player_id] 
        const rate = stream.getUint8();
        this.SERVER_SEND_RATE = rate;
        this.SERVER_SEND_INTERVAL = (1/rate);

        // These may desync over time. Maybe resend them every now and then if it becomes an issue?
        this.REFERENCE_SERVER_TICK_TIME = stream.getBigUint64();
        this.REFERENCE_SERVER_TICK_ID = stream.getUint16();
        this.PLAYER_ID = stream.getUint8();

        console.log("My player id is: " + this.PLAYER_ID);
    }


    public sendPing(){
        // Sends unix time stamp in ms 
        const stream = new BufferStreamWriter(new ArrayBuffer(9));

        stream.setUint8(ServerBoundPacket.PING);
        stream.setBigInt64(BigInt(Date.now()));

        this.send(stream.getBuffer());
    }
 
    private calculatePing(stream: BufferStreamReader){
        // bigint64 : the unix timestamp I sent
        // bigint64 : server time stamp
    
        const originalStamp = stream.getBigInt64();
        const serverStamp = stream.getBigInt64();

        const currentTime = BigInt(Date.now());

        const pingThisTime = ceil(Number((currentTime - originalStamp)) / 2);
        
        
        /*  TODO: implement some sort of smoothing of the ping. Sample it multiple times
            Because frameToGet depends on this.ping, constantly re-adjusting ping will cause jitter in game whenever receive pong packet. 
            
            If becomes noticible, calculate ping over many frames and take average to stand in for ping when calculating value.
                and, if this value doesn't change enough, then don't bother jittering stuff, or 
                slowly interpolate that value to the real one so it's a smooth transition    
        */

        // only adjust the ping if it has changed sufficintely
        if(abs(this.ping - pingThisTime) > 4){
            this.ping = pingThisTime;
        }

        if(this.ping === 0) this.ping = 1;
        if(this.ping < 0) console.log("Ping is negative") 

        console.log("Ping:" + this.ping);
    
        // This method assumes latency is equal both ways
        const delta = serverStamp - currentTime + BigInt(this.ping);

        // LOCAL TIME + CLOCK_DELTA === TIME_ON_SERVER
        this.CLOCK_DELTA = Number(delta);

        
    }

    /** Includes fractional part of tick */
    public getServerTickToSimulate(): number {

        // console.log(this.CLOCK_DELTA);

        // In milliseconds
        const serverTime = Date.now() + this.CLOCK_DELTA;

        // If ping is inaccurate, this will break. 
        // If this.ping is a lot lower than it really is, interpolation will break. 
        // If too high, just makes interpolation a bit farther in the past. 
        // Maybe add some padding just in case, of a couple ms?

        const serverTimeOfPacketJustReceived = serverTime - this.ping;

        const serverTimeToSimulate = serverTimeOfPacketJustReceived - this.dejitterTime;

        // Now we know what 'server time' frame to simulate, need to convert it to a frame number
        const msPassedSinceLastTickReference = serverTimeToSimulate - Number(this.REFERENCE_SERVER_TICK_TIME);

        
        // Divide by thousand in there to convert to seconds, which is the unit of SERVER_SEND_RATE 
        const theoreticalTickToSimulate = this.REFERENCE_SERVER_TICK_ID + (((msPassedSinceLastTickReference / 1000) * (this.SERVER_SEND_RATE)));
        
        // console.log(currentServerTick);
        
        // Includes fractional part of tick
        //  - 1, because need to interpolate from last frame to current frame. We don't necesarrily even have floor(theoreticalTickToSimulate) + 1 yet, 
        const frameToGet = theoreticalTickToSimulate - 1;
        
        return frameToGet;
    }

    getNewPacketQueue(){
        return this.packets;
    }

}








