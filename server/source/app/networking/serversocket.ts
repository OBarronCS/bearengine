

import WS, { createWebSocketStream } from "ws"
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/bufferstream"
import { ClientBoundImmediate, ClientBoundSubType, GamePacket, ServerBoundPacket, ServerImmediatePacket, ServerPacketSubType } from "shared/core/sharedlogic/packetdefinitions";
import { LinkedQueue } from "shared/datastructures/queue";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { IncomingMessage } from "http";

export type ConnectionID = number;

interface BufferedPacket {
    client: ConnectionID;
    buffer: BufferStreamReader;
}

// class SocketWrapper {
//     connectionID: ConnectionID;
//     socket: WS;
//     constructor(){
//         // this.socket.
//     }
// }

export class ServerNetwork {
    //private readonly port: number;

    protected server: WS.Server;

    private NEXT_CONNECTION_ID: ConnectionID = 0;

    // List of connections. WS also has a built into way to do this
    protected sockets: WS[] = [];

    private clientMap = new Map<WS,ConnectionID>();
    private reverseClientMap = new Map<ConnectionID, WS>();

    private packets = new LinkedQueue<BufferedPacket>();
    
    private onClientConnect: (clientID: ConnectionID) => void;
    private onClientDisconnect: (clientID: ConnectionID) => void;
    
    constructor(server: WS.Server){
        this.server = server;
    }

    /** Start handling websocket connections 
     *  Pass in callbacks to handle new connections, disconnections
    */
    public start(onConnect: ServerNetwork["onClientConnect"], onDisconnect: ServerNetwork["onClientDisconnect"]){
        this.server.on("connection", this.newClient.bind(this));

        this.server.on("close", () => {
            console.log("Server closed")
        });

        this.onClientConnect = onConnect;
        this.onClientDisconnect = onDisconnect;
    }

    /** On client connection. Socket is unique to client */
    private newClient(socket: WS, requestInfo: IncomingMessage){
        console.log("New connection");
        // console.log(requestInfo.headers.origin)
        // console.log(requestInfo.rawHeaders)
        // console.log(requestInfo.toString())

        socket.binaryType = "arraybuffer";
        this.sockets.push(socket);

        const connectionID = this.NEXT_CONNECTION_ID++;

        this.clientMap.set(socket,connectionID);
        this.reverseClientMap.set(connectionID, socket);

        // Tell engine that a player joined 
        this.onClientConnect(connectionID);
        

        socket.on("close", () => {
            const client = this.clientMap.get(socket);

            if(client === undefined) throw new Error("Closing socket from unknown client. If this error goes off then there is something deeply wrong");
            console.log("Client disconnected, ", client);


            // Tell engine that player left
            this.onClientDisconnect(client)


            // This is the last message associated with this socket
            this.clientMap.delete(socket);
            this.reverseClientMap.delete(client);
            
            const index = this.sockets.indexOf(socket);
            this.sockets.splice(index,1);
        });

        socket.on("message", (data: ArrayBuffer) => {
            const stream = new BufferStreamReader(data);

            const type: ServerPacketSubType = stream.getUint8();

            switch(type){
                case ServerPacketSubType.IMMEDIATE: {
                    const subtype: ServerImmediatePacket = stream.getUint8();
                    switch(subtype){
                        case ServerImmediatePacket.PING: {
                            // Immediately send back pong
                            const writer = new BufferStreamWriter(new ArrayBuffer(1 + 1 + 8 + 8));

                            writer.setUint8(ClientBoundSubType.IMMEDIATE);
                            writer.setUint8(ClientBoundImmediate.PONG);
                            // copies the timestamp that was received, sends it back
                            writer.setBigInt64(stream.getBigInt64());
                            writer.setBigInt64(BigInt(Date.now()));

                            socket.send(writer.getBuffer());
                            
                            break;
                        }
                        default: AssertUnreachable(subtype);
                    }
                    break;
                }
                case ServerPacketSubType.QUEUE: {
                    const client = this.clientMap.get(socket);

                    if(client === undefined) throw new Error("Processing game data from unknown client. If this error goes off then there is something deeply wrong");
        
                    this.packets.enqueue({
                        client:client,
                        buffer: stream,
                    });
                    break;
                }

                default: AssertUnreachable(type);
            }           
        });


    }
    

    public getPacketQueue(){
        return this.packets;
    }

    public send(client: ConnectionID, buffer: ArrayBuffer){
        const socket = this.reverseClientMap.get(client);

        // If this happens, it means the player has disconnected, but the engine has yet to read that packet 
        if(socket === undefined) throw new Error("Cannot find client, " + client);

        socket.send(buffer);        
    }

    public broadcast(buffer: ArrayBuffer | ArrayBufferView){
        for(const clientSocket of this.sockets){
            // if (client.readyState === WebSocket.OPEN)
            clientSocket.send(buffer);
            
        }
    }

    public kickclient(clientID: ConnectionID){
        const socket = this.reverseClientMap.get(clientID);
        socket.close();
        // socket.terminate(); --> closes immediately
    }

    public closeServer(){
        this.server.close();
    }
}


