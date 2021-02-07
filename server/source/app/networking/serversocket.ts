

import WS from "ws"
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket, GameStatePacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { RemotePlayer } from "../serverentity";
import { ServerBearEngine } from "../serverengine";

export class ServerNetwork {
    private readonly TICK_RATE: number;
    private readonly port: number;

    protected socket: WS.Server = null;
    
    public referenceTime: bigint = 0n;
    public referenceTick: number = 0;

    public tick = 0;

    // List of connections
    protected sockets: WS[] = []

    // TODO: move this out of the server network class
    private playerMap = new Map<WS,RemotePlayer>();

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
        
        const p = new RemotePlayer()
        this.playerMap.set(socket,p);

        socket.on("close", () => {

        })

        this.engine.addNetworkedEntity(p);

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
            const type = stream.getUint8();

            switch(type){
                case ServerBoundPacket.PING: this.sendPong(socket,stream); break;
                case ServerBoundPacket.PLAYER_POSITION: this.playerPosition(socket, stream); break;
                default: console.log("Player sent unknown data")
            }
        })
    }

    playerPosition(socket: WS, stream: BufferStreamReader){
        const p = this.playerMap.get(socket);
        p.x = stream.getFloat32();
        p.y = stream.getFloat32();
    }

    sendPong(socket: WS, stream: BufferStreamReader){
        const writer = new BufferStreamWriter(new ArrayBuffer(17));
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


