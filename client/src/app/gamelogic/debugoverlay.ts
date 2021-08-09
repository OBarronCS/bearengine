import { Container, Text } from "pixi.js";
import { Subsystem } from "shared/core/subsystem";
import { randomChar } from "shared/misc/random";
import { NetworkPlatformGame } from "../core-engine/bearengine";


export class DebugScreen extends Subsystem<NetworkPlatformGame> {
    

    container = new Container();

    y = 5;

    
    private bytesPerSecond = this.addTextField();

    addTextField(): Text {
        const t = new Text("asdas");
        t.y = this.y;
        this.y += t.height + 1;

        this.container.addChild(t);
        return t;
    }

    init(): void {

        this.engine.renderer.addGUI(this.container);
    }


    update(delta: number): void {
        
        this.bytesPerSecond.text = "B/s: " + this.game.networksystem.bytesPerSecond;
        
        
        if(this.engine.keyboard.wasPressed("Tab")){
            this.container.visible = !this.container.visible;
        }
    }
    
} 
