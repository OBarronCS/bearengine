
import express from "express";
import { readFile } from "fs";
import path from "path";
import WS from "ws"

const app = express();
// Seetings thedirectory which has static assets
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

const buffer = new ArrayBuffer(64);
const view = new DataView(buffer);
view.setFloat64(0,1825496312.323983);

const ws = new WS.Server( {port:8080} )
ws.on("connection", (socket) => {
    console.log("New connection")
    socket.send(view);
})

app.listen(8000, () => {
    console.log("we are good to goo!")
})



