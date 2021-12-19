import { Subsystem } from "shared/core/subsystem";
import { Color } from "shared/datastructures/color";
import { Vec2 } from "shared/shapes/vec2";
import { NetworkPlatformGame } from "../core-engine/bearengine";
import { ButtonWidget, LabelWidget, SpriteWidget, UIManager } from "../ui/widget";


export class MyUI extends Subsystem<NetworkPlatformGame> {
    
    ui: UIManager = new UIManager();
    init(): void {
        this.engine.renderer.addGUI(this.ui.base_container);  
    }

    some_text = (() => { 
        const b = this.ui.addWidget(new ButtonWidget(new Vec2(500,50), 100,50, () => 1));
        b.background_color.copyFrom(Color.fromNumber(0xdeadbeef)) 
        b.draw_color.copyFrom(b.background_color)
        return b;
    })();

    BOX = (() =>  { 
        const b = this.ui.addWidget(new ButtonWidget(new Vec2(300,50), 100,50, () => console.log("123")));
        b.background_color.copyFrom(Color.fromNumber(0xdeadbeef)) 
        b.draw_color.copyFrom(b.background_color)
        return b;
    })();

    actual_text = this.ui.addWidget(new LabelWidget(new Vec2(700,70), "Hi"))
    
    spr = this.ui.addWidget(new SpriteWidget(new Vec2(400,60), this.game.engine.renderer.getTexture("flower.png")))
    
    update(delta: number): void {
        this.ui.update(this.engine.mouse.guiPosition, this.engine.mouse.isDown("left"), this.engine.mouse.wasPressed("left"), this.engine.mouse.wasReleased("left"), false);
        this.ui.render();
    }
}
