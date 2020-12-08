
import express from "express";
import { readFile } from "fs";
import path from "path";
import { ViewableBuffer } from "pixi.js";
import { start } from "repl";
import WS from "ws"

const app = express();

// Setting the directory which has static assets
app.use(express.static(path.join(__dirname, "../../dist")));

app.get("/", (request, response) => {
    readFile("./index.html", "utf-8", (err, html) => {
        
        if(err){
            console.log(err)
            response.status(500).send("errororor")
        }

        response.send(html);

    })
   

});

const TICK_RATE = 20;
const buffer = new ArrayBuffer(2);
const initInfo = new DataView(buffer);
initInfo.setUint8(0,1);
initInfo.setUint8(1, TICK_RATE)

const ws = new WS.Server( { port:8080 } )


const sockets: WS[] = []

let tick = 0;
ws.on("connection", (socket) => {
    console.log("New connection")
    sockets.push(socket);

    socket.send(initInfo.buffer);

    const buffer2 = new ArrayBuffer(3);
    const prepareTicking = new DataView(buffer2);
    prepareTicking.setUint8(0,2);
    prepareTicking.setUint16(1,tick);
    
    socket.send(prepareTicking.buffer)

    socket.binaryType = "arraybuffer"

    socket.on('message', (data) => {     
        // Assumes all messages are ping for now   
        const dataview = new DataView(data as ArrayBuffer);

        // Copies the data over
        const finalBuffer = new Uint8Array(new ArrayBuffer(17));
        finalBuffer.set(new Uint8Array(data as ArrayBuffer));

        const view = new DataView(finalBuffer.buffer);
        const now = BigInt(Date.now());
        view.setBigInt64(9, now)

        socket.send(view)
    })
})

let previousTick = Date.now();


function gameLoop(){
    const now = Date.now();

    // If we have made it far enough to TICK THE GAME
    if (previousTick + (1000 / TICK_RATE) <= now) {
        console.log(now - previousTick);
        previousTick = now

        GameTick();
    }

    // if we are more than 16 milliseconds away from the next tick
    if(now - previousTick < (1000 / TICK_RATE) - 16) {
        setTimeout(gameLoop) // sloppy timer
    } else {
        setImmediate(gameLoop) // ultra accurate method
    }
}

function GameTick(){
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0,3);
    view.setInt16(1,tick);

    sockets.forEach((client) => {
        //if (client.readyState === WebSocket.OPEN) {
            client.send(buffer);
    //       }
    })
    tick++;
}


gameLoop();


app.listen(8000, () => {
    console.log("we are good to goo!")
})



