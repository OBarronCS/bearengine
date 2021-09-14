
import { Server } from "ws";
import express from "express";
import { readFile } from "fs";

import path from "path";

import { ServerBearEngine } from "./app/serverengine";
import { ReadLine, createInterface } from "readline";

const app = express();

// Setting the directory which has static assets
app.use(express.static(path.join(__dirname, "../../client/dist")));


app.get("/", (request, response) => {
    readFile("./index.html", "utf-8", (err, html) => {
        
        if(err){
            console.log(err)
            response.status(500).send("errororor")
        }

        response.send(html);
    })
});


const http_server = app.listen(80,() => {
    console.log("we are good to goo!")
});

const websocket_server = new Server({ server: http_server })

const TICK_RATE = 10;
const engine = new ServerBearEngine(TICK_RATE);

engine.start(websocket_server);



// Callback for input --> 
const rl: ReadLine = createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input: string) => {

    const allWords = input.split(" ");

    const first = allWords[0];

    if(first.charAt(0) === "/"){
        engine.dispatchCommand(input.slice(1));
    } else {
        switch(first){
            case "command": {
                engine.dispatchCommand(allWords.slice(1).join(" "));
                break
            }

            case "end": {
                engine.endMatch()
                break;
            }

            default: {
                console.log("You made a typo")
            }
        }
    }
});


