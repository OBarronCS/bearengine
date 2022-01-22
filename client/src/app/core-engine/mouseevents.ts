import { Subsystem } from "shared/core/subsystem";
import type { BearEngine, NetworkPlatformGame } from "./bearengine";

export class TestMouseDownEventDispatcher extends Subsystem<NetworkPlatformGame> {
    
    init(): void {}

    
    private taphandler = this.addEventDispatcher("tap");
    private mousehover = this.addEventDispatcher("mousehover");
    private mousedown = this.addEventDispatcher("mousedown");
    private scroll = this.addEventDispatcher("scroll");

    update(delta: number): void {
        const mouse = this.engine.mouse;
        const collision = this.game.collisionManager;


        const underMouse = collision.circle_query(mouse.x, mouse.y, 1);

        const scroll = mouse.scroll;
        if(scroll !== 0){
            for(const listener of this.scroll){
                if(underMouse.indexOf(listener.entity) !== -1){
                    this.scroll.dispatch(listener, scroll, mouse.position);
                }
            }
        }

        for(const listener of this.mousehover){
            if(underMouse.indexOf(listener.entity) !== -1){
                this.mousehover.dispatch(listener, mouse.position);
            }
        }

        if(mouse.wasReleased("left")){
            for(const taplistener of this.taphandler){
                if(underMouse.indexOf(taplistener.entity) !== -1){
                    this.taphandler.dispatch(taplistener, mouse.position);
                }
            } 
        }

        for(const down of this.mousedown){
            if(underMouse.indexOf(down.entity) !== -1){
                if(mouse.isDown(down.extradata.button))
                    this.mousedown.dispatch(down, mouse.position);
            }
        }

        
    }

}
