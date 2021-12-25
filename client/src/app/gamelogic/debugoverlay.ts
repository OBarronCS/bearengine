import { Container, Graphics, Text, TilingSprite } from "shared/graphics/graphics";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { Subsystem } from "shared/core/subsystem";
import { round } from "shared/misc/mathutils";
import { randomChar } from "shared/misc/random";
import { NetworkPlatformGame } from "../core-engine/bearengine";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { ExpandingTextPanel } from "../ui/widget";


export class DebugScreen extends Subsystem<NetworkPlatformGame> {
    

    otherClientInfo = new Graphics();
    otherClientText = new Text("");

    private left_panel = new ExpandingTextPanel(new Vec2(0,5));

    private mouse_position = this.left_panel.addTextField("");
    private mouse_screen_position = this.left_panel.addTextField("");
    private connected_to_network = this.left_panel.addTextField("");
    private gamemode = this.left_panel.addTextField("");
    private bytesPerSecond = this.left_panel.addTextField("");
    private ping = this.left_panel.addTextField("");

    // container = new Container();

    // y = 5;
    // private mouse_position = this.addTextField();
    // private mouse_screen_position = this.addTextField();
    // private connected_to_network = this.addTextField();
    // private gamemode = this.addTextField();
    // private bytesPerSecond = this.addTextField();
    // private ping = this.addTextField();

    // addTextField(): Text {
    //     const t = new Text("");
    //     t.y = this.y;
    //     this.y += t.height + 1;

    //     this.container.addChild(t);
    //     return t;
    // }

    init(): void {
        // this.engine.renderer.addGUI(this.container);
        this.game.ui.addWidget(this.left_panel);

        this.engine.renderer.addGUI(this.otherClientInfo);
        this.engine.renderer.addGUI(this.otherClientText);
    }


    update(delta: number): void {
        this.mouse_position.text = `${round(this.engine.mouse.position.x, 1)},${round( this.engine.mouse.position.y, 1)}`;
        this.mouse_screen_position.text = `${round(this.engine.mouse.guiPosition.x, 1)},${round( this.engine.mouse.guiPosition.y, 1)}`;
        this.connected_to_network.text = "Connected: " + (this.game.networksystem["network"].CONNECTED ? "True" : "False");
        this.gamemode.text = "Gamemode: " + ClientPlayState[this.game.networksystem.currentPlayState];
        this.bytesPerSecond.text = "B/s: " + this.game.networksystem.bytesPerSecond;
        this.ping.text = "Ping: " + this.game.networksystem["ping"]
        
        if(this.engine.keyboard.wasPressed("Digit3")){
            this.left_panel.toggleVisible();
        }
        
        this.otherClientInfo.clear();
        this.otherClientText.text = "";

        if(this.engine.keyboard.isDown("Digit1")){
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
    




    dump_state(): GameStateDump {

        return {
            log:[

            ],
            entity_state: {

            },
            keyboard_state:{
                
            },
            mouse_state: {
                position: this.engine.mouse.position.toCoordinate(),
                velocity: this.engine.mouse.velocity.toCoordinate(),
                cursor_sprite: "",
            }
        }
    }
} 

interface GameStateDump {
    log: string[];

    entity_state: object;

    keyboard_state: object;

    mouse_state: {
        position: Coordinate,
        velocity: Coordinate,
        cursor_sprite: string
    }
}

const ALL_BEAR_LOGS: string[] = []


export function BEAR_LOG(log: string): void {
    ALL_BEAR_LOGS.push(log);
}

// Allow it to take in any type, and just figure it out
// BEAR_LOG.info();
// BEAR_LOG.error();
// BEAR_LOG.warn();

