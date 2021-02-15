

import WS from "ws"
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket, ClientPacket, GamePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { ServerBearEngine } from "../serverengine";
import { LinkedQueue } from "shared/datastructures/queue";
import { AssertUnreachable } from "shared/assertstatements";

export class ClientConnection {
    id: number;
    ping: number;
}

interface BufferedPacket {
    client: ClientConnection;
    buffer: BufferStreamReader;
}

export class ServerNetwork {
    private readonly TICK_RATE: number;
    private readonly port: number;

    protected socket: WS.Server = null;
    
    public referenceTime: bigint = 0n;
    public referenceTick: number = 0;

    public tick = 0;

    // List of connections. WS also has some built into way to do this...
    protected sockets: WS[] = [];
    private clientMap = new Map<WS,ClientConnection>();
    
    private packets = new LinkedQueue<BufferedPacket>();

    constructor(tickRate:number, port: number, public engine: ServerBearEngine){
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
        socket.binaryType = "arraybuffer";
        this.sockets.push(socket);

        this.clientMap.set(socket, new ClientConnection());

        socket.on("close", () => {
            
            const client = this.clientMap.get(socket);

            if(client === undefined) throw new Error("Closing socket from unknown client. If this error goes off then there is something deeply wrong");

            const stream = new BufferStreamWriter(new ArrayBuffer(3))
            stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);
            stream.setUint8(ClientPacket.LEAVE_GAME);

            this.packets.enqueue({
                client:client,
                buffer: new BufferStreamReader(stream.getBuffer()),
            });

            // This is the last message associated with this socket
            this.clientMap.delete(socket);
            const index = this.sockets.indexOf(socket);
            this.sockets.splice(index,1);
        })

        console.log("New connection")
        
        // INIT DATA. 
        const init_writer = new BufferStreamWriter(new ArrayBuffer(12))
        init_writer.setUint8(ClientBoundPacket.INIT);

        init_writer.setUint8(this.TICK_RATE)
        init_writer.setBigUint64(this.referenceTime);
        init_writer.setUint16(this.referenceTick);
        socket.send(init_writer.getBuffer());
    

        // START TICKING
        const start_tick_writer = new BufferStreamWriter(new ArrayBuffer(3))
        start_tick_writer.setUint8(ClientBoundPacket.START_TICKING);
        
        start_tick_writer.setUint16(this.tick);
        socket.send(start_tick_writer.getBuffer())


        socket.on('message', (data: ArrayBuffer) => {
            // Assumes all messages are ping for now   
            const stream = new BufferStreamReader(data)

            const type: ServerBoundPacket = stream.getUint8();

            switch(type){
                case ServerBoundPacket.PING: this.sendPong(socket,stream); break;
                case ServerBoundPacket.CLIENT_STATE_PACKET: this.processGameData(socket, stream); break;
                default: AssertUnreachable(type);
            }
        });
    }

    private processGameData(socket: WS, stream: BufferStreamReader){

        const client = this.clientMap.get(socket);

        if(client === undefined) throw new Error("Processing game data from unknown client. If this error goes off then there is something deeply wrong");

        this.packets.enqueue({
            client:client,
            buffer: stream,
        });
    }

    public packetQueue(){
        return this.packets;
    }



    sendPong(socket: WS, stream: BufferStreamReader){
        const writer = new BufferStreamWriter(new ArrayBuffer(1 + 8 + 8));
        writer.setUint8(ClientBoundPacket.PONG);
        // copies the timestamp that was received, sends it back
        writer.setBigInt64(stream.getBigInt64());
        writer.setBigInt64(BigInt(Date.now()));

        socket.send(writer.getBuffer())
    }


    onmessage(socket: WS, ev: MessageEvent<any>): void {

    }

    writePacketStateData(stream: BufferStreamWriter){
        stream.setUint8(ClientBoundPacket.GAME_STATE_PACKET);
        stream.setUint16(this.tick);
    }

    sendGameData(buffer: ArrayBuffer | ArrayBufferView, time: number){
        // TODO: Move this to the beginning of the tick, not the end; If simulation takes a while, this will be completely innaccurate
        // However, will be fine if simulation consistantly takes the same amount of time
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


