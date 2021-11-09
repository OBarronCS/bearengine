import { Container, Graphics, Text, TilingSprite } from "shared/graphics/graphics";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { Subsystem } from "shared/core/subsystem";
import { round } from "shared/misc/mathutils";
import { randomChar } from "shared/misc/random";
import { NetworkPlatformGame } from "../core-engine/bearengine";


export class DebugScreen extends Subsystem<NetworkPlatformGame> {
    

    otherClientInfo = new Graphics();
    otherClientText = new Text("");


    container = new Container();

    y = 5;
    private mouse_position = this.addTextField();
    private connected_to_network = this.addTextField();
    private gamemode = this.addTextField();
    private bytesPerSecond = this.addTextField();
    private ping = this.addTextField();

    addTextField(): Text {
        const t = new Text("");
        t.y = this.y;
        this.y += t.height + 1;

        this.container.addChild(t);
        return t;
    }

    init(): void {
        this.engine.renderer.addGUI(this.container);
        this.engine.renderer.addGUI(this.otherClientInfo);
        this.engine.renderer.addGUI(this.otherClientText);
    }


    update(delta: number): void {
        this.mouse_position.text = `${round(this.engine.mouse.position.x, 1)},${round( this.engine.mouse.position.y, 1)}`;
        this.connected_to_network.text = "Connected: " + (this.game.networksystem["network"].CONNECTED ? "True" : "False");
        this.gamemode.text = "Gamemode: " + ClientPlayState[this.game.networksystem.currentPlayState];
        this.bytesPerSecond.text = "B/s: " + this.game.networksystem.bytesPerSecond;
        this.ping.text = "Ping: " + this.game.networksystem["ping"]
        
        if(this.engine.keyboard.wasPressed("Digit3")){
            this.container.visible = !this.container.visible;
        }

        this.otherClientInfo.clear();
        this.otherClientText.text = "";

        if(this.engine.keyboard.isDown("KeyC")){
            this.otherClientInfo.beginFill(0x0000FF,.1);

            const width = 480;
            const height = 300
            const x = this.engine.renderer.getPercentWidth(.26) - (width / 2);
            const y = 50;


            this.otherClientText.position.set(x,y);

            this.otherClientInfo.drawRect(x, y, width, height);

            for(const client of this.game.networksystem.otherClients.values()){
                this.otherClientText.text += client.toString() + "\n"
            }
        }
    }
    
} 
