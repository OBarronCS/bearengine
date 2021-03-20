

import WS from "ws"
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream"
import { ClientBoundPacket, ClientPacket, ServerBoundPacket } from "shared/core/sharedlogic/packetdefinitions";
import { LinkedQueue } from "shared/datastructures/queue";
import { AssertUnreachable } from "shared/assertstatements";

// maybe swap this with just an integer, and then the server calls some methods here with this id to get info? 
export class ClientConnection {
    id: number;
    ping: number;
}

interface BufferedPacket {
    client: ClientConnection;
    buffer: BufferStreamReader;
}

export class ServerNetwork {
    //private readonly port: number;

    protected server: WS.Server = null;

    // List of connections. WS also has some built into way to do this...
    protected sockets: WS[] = [];
    private clientMap = new Map<WS,ClientConnection>();
    private reverseClientMap = new Map<ClientConnection, WS>();

    private packets = new LinkedQueue<BufferedPacket>();
    

    constructor(server: WS.Server){
        this.server = server;
    }

    /** Start handling connections */
    public start(){
        this.server.on("connection", this.sendStartData.bind(this));

        this.server.on("close", () => {
            console.log("Server closed")
        });
    }

    /** On client connection. Socket is unique to client */
    private sendStartData(socket: WS){
        console.log("New connection");

        socket.binaryType = "arraybuffer";
        this.sockets.push(socket);

        const connection = new ClientConnection();

        this.clientMap.set(socket,connection);
        this.reverseClientMap.set(connection, socket);


        socket.on("close", () => {
            console.log("Client disconnected");
            const client = this.clientMap.get(socket);

            if(client === undefined) throw new Error("Closing socket from unknown client. If this error goes off then there is something deeply wrong");

            // Sends this info to the engine as a packet. 
            const stream = new BufferStreamWriter(new ArrayBuffer(3))
            stream.setUint8(ServerBoundPacket.CLIENT_STATE_PACKET);
            stream.setUint8(ClientPacket.LEAVE_GAME);

            this.packets.enqueue({
                client:client,
                buffer:new BufferStreamReader(stream.getBuffer()),
            });

            // This is the last message associated with this socket
            this.clientMap.delete(socket);
            this.reverseClientMap.delete(client);
            const index = this.sockets.indexOf(socket);
            this.sockets.splice(index,1);
        });

        socket.on('message', (data: ArrayBuffer) => {
            const stream = new BufferStreamReader(data);

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

    private sendPong(socket: WS, stream: BufferStreamReader){
        const writer = new BufferStreamWriter(new ArrayBuffer(1 + 8 + 8));
        writer.setUint8(ClientBoundPacket.PONG);
        // copies the timestamp that was received, sends it back
        writer.setBigInt64(stream.getBigInt64());
        writer.setBigInt64(BigInt(Date.now()));

        socket.send(writer.getBuffer())
    }

    public packetQueue(){
        return this.packets;
    }

    public send(client: ClientConnection, buffer: ArrayBuffer){
        const socket = this.reverseClientMap.get(client);
        if(socket === undefined) throw new Error("Cannot find client, " + client);

        socket.send(buffer);        
    }

    public broadcast(buffer: ArrayBuffer | ArrayBufferView){
        for(const clientSocket of this.sockets){
            // if (client.readyState === WebSocket.OPEN)
            clientSocket.send(buffer);
            
        }
    }

    public closeServer(){
        this.server.close();
    }
}


