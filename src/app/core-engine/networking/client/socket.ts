
/*

    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, 
        Recieving buffers
*/

import { LinkedQueue } from "../../../math-library/queue";



export abstract class Network {

    private socket: WebSocket = null;
    private url: string;

    constructor(url: string){
        this.url = url;
    }

    public connect(){
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
            console.log("Connected");
            this.onopen();
        }

        this.socket.onclose = () => {
            console.log("Disconected")
            this.onclose();
        }

        this.socket.onmessage = this.onmessage;
    }

    abstract onopen(): void;
    abstract onclose(): void;
    abstract onmessage(this: WebSocket, ev: MessageEvent<any>): void;

    public send(buffer: ArrayBuffer | ArrayBufferView){
        this.socket.send(buffer);
    }

    public disconnect(){
        this.socket.close();
    }
}

//instead of calling callback immediately, buffer it for a moment
//this means that main game loop needs to tick this up to hold internal timer
export class BufferedNetwork extends Network {

    private packets = new LinkedQueue<ArrayBuffer>();

    onopen(): void {
        
    }

    onclose(): void {

    }

    onmessage(this: WebSocket, ev: MessageEvent<any>): void {
        console.log(this)
    }



    public tick(delta: number){

    }
}








