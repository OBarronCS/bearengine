
import { Server } from "ws";
import express from "express";
import { readFile } from "fs";

import path from "path";

import { ServerBearEngine } from "./app/serverengine";

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
// const http_server = app.listen(80,"10.0.0.144");

const websocket = new Server({ server: http_server })

const TICK_RATE = 10;
const engine = new ServerBearEngine(TICK_RATE);

engine.start(websocket);


