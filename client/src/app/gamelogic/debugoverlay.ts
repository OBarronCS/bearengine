import { Container, Text } from "pixi.js";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { Subsystem } from "shared/core/subsystem";
import { round } from "shared/misc/mathutils";
import { randomChar } from "shared/misc/random";
import { NetworkPlatformGame } from "../core-engine/bearengine";


export class DebugScreen extends Subsystem<NetworkPlatformGame> {
    

    container = new Container();

    y = 5;
    private mouse_position = this.addTextField();
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
    }


    update(delta: number): void {
        this.mouse_position.text = `${round(this.engine.mouse.position.x, 1)},${round( this.engine.mouse.position.y, 1)}`;
        this.gamemode.text = "Gamemode: " + ClientPlayState[this.game.networksystem.currentPlayState];
        this.bytesPerSecond.text = "B/s: " + this.game.networksystem.bytesPerSecond;
        this.ping.text = "Ping: " + this.game.networksystem["ping"]
        
        if(this.engine.keyboard.wasPressed("Digit3")){
            this.container.visible = !this.container.visible;
        }
    }
    
} 
