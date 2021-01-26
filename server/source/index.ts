
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

const TICK_RATE = 10;

const engine = new ServerBearEngine(TICK_RATE);

engine.start(8080);



app.listen(8000,() => {
    console.log("we are good to goo!")
})



