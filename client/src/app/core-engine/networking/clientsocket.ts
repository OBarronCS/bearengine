/*
    Client side socket connection to a server:
        Deals with connecting to server,
        Sending, Receiving buffers
*/

export interface NetworkSettings {
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


export class CallbackNetwork extends Network {

    public onmessagecallback: (buffer: ArrayBuffer) => void

    constructor(settings: NetworkSettings, onmessagecallback: (buffer: ArrayBuffer) => void){
        super(settings);
        this.onmessagecallback = onmessagecallback;
    }

    onopen(): void {
        console.log("Connected to server");
    }

    onclose(): void {
        console.log("Connection closed")
    }

    onmessage(ev: MessageEvent<any>): void {
        this.onmessagecallback(ev.data);
    }
}










