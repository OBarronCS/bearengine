import { Container, Graphics, Text, TilingSprite } from "shared/graphics/graphics";
import { ClientPlayState } from "shared/core/sharedlogic/sharedenums";
import { Subsystem } from "shared/core/subsystem";
import { E, round } from "shared/misc/mathutils";
import { randomChar } from "shared/misc/random";
import { NetworkPlatformGame } from "../core-engine/bearengine";
import { Coordinate, Vec2 } from "shared/shapes/vec2";
import { ExpandingTextPanel, LabelWidget, PanelWidget, WidgetGroup } from "../ui/widget";
import { Color } from "shared/datastructures/color";
import { DrawableEntity } from "../core-engine/entity";


export class DebugScreen extends Subsystem<NetworkPlatformGame> {

    private left_panel = new ExpandingTextPanel(new Vec2(0,5));

    private mouse_position = this.left_panel.addTextField("");
    private mouse_screen_position = this.left_panel.addTextField("");
    private connected_to_network = this.left_panel.addTextField("");
    private gamemode = this.left_panel.addTextField("");
    private bytesPerSecond = this.left_panel.addTextField("");
    private ping = this.left_panel.addTextField("");
    private camera = this.left_panel.addTextField("");


    private other_client_info_panel: PanelWidget;
    private other_client_info_text: LabelWidget;

    init(): void {
        this.game.ui.addWidget(this.left_panel);

        const width = 480;
        const height = 300

        const x_percent = .26;
        const y = 200;

        this.other_client_info_panel = new PanelWidget(new Vec2(), width, height);
        this.other_client_info_panel.setPosition({type:"percent", percent: x_percent}, {type:"pixels", pixels:y});
        this.other_client_info_panel.center();
        this.other_client_info_panel.background_color = Color.fromNumber(0x0000FF);
        this.other_client_info_panel.background_color.a = .1

        this.other_client_info_text = this.other_client_info_panel.addChild(new LabelWidget(new Vec2(), ""));

        this.other_client_info_panel.setVisible(false)

        this.game.ui.addWidget(this.other_client_info_panel);
    }


    private collision_drawer: Debug = null;

    update(delta: number): void {
        this.mouse_position.text = `World: ${round(this.engine.mouse.position.x, 1)},${round( this.engine.mouse.position.y, 1)}`;
        this.mouse_screen_position.text = `GUI: ${round(this.engine.mouse.guiPosition.x, 1)},${round( this.engine.mouse.guiPosition.y, 1)}`;
        this.connected_to_network.text = "Connected: " + (this.game.networksystem["network"].CONNECTED ? "True" : "False");
        this.gamemode.text = "Gamemode: " + ClientPlayState[this.game.networksystem.currentPlayState];
        this.bytesPerSecond.text = "B/s: " + this.game.networksystem.bytesPerSecond;
        this.ping.text = "Ping: " + this.game.networksystem["ping"]
        this.camera.text = "Zoom: " + this.game.engine.camera.zoom;

        if(this.engine.keyboard.wasPressed("Digit3")){
            this.left_panel.toggleVisible();
        }
        
        if(this.engine.keyboard.wasPressed("Digit1")){
            this.other_client_info_panel.setVisible(true);

            let txt = "";
           
            for(const client of this.game.networksystem.otherClients.values()){
                txt += client.toString() + "\n"
            }

            this.other_client_info_text.setText(txt);
        } else if(this.engine.keyboard.wasReleased("Digit1")) {
            this.other_client_info_panel.setVisible(false);
        }
        
        if(this.engine.keyboard.wasReleased("Digit0")){
            if(this.collision_drawer){
                this.game.entities.destroyEntity(this.collision_drawer);
                this.collision_drawer = null;
            } else {   
                this.collision_drawer = this.game.entities.addEntity(new Debug());
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

// Drawing the collision grid
class Debug extends DrawableEntity {
    update(dt: number): void {
        this.redraw();
    }
    draw(g: Graphics): void {
        g.clear();
        this.game.collisionManager.draw(g);
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

