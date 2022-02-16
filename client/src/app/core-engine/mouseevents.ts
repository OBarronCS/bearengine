import { SimpleEventDispatcher } from "shared/core/bearevents";
import { getEntityIndex } from "shared/core/entitysystem";
import { Subsystem } from "shared/core/subsystem";
import type { BearEngine, NetworkPlatformGame } from "./bearengine";

export class TestMouseDownEventDispatcher extends Subsystem<NetworkPlatformGame> {
    
    init(): void {}

    
    // private taphandler = this.addEventDispatcher("tap");
    // private mousehover = this.addEventDispatcher("mousehover");
    private mousedown = this.addEventDispatcher(new SimpleEventDispatcher("mouse_down"));
    // private scroll = this.addEventDispatcher("scroll");

    update(delta: number): void {
        const mouse = this.engine.mouse;
        const collision = this.game.collisionManager;


        const under_mouse = collision.circle_query_list(mouse.x, mouse.y, 1, null);
        
        for(const e of under_mouse){
            const listener = this.mousedown.get_entity_event_data(getEntityIndex(e.entity.entityID));
            if(listener !== null){
                if(mouse.isDown(listener.extradata[0])){
                    this.mousedown.dispatch(listener, mouse.position);
                }
            }
        }

        // const scroll = mouse.scroll;
        // if(scroll !== 0){
        //     for(const listener of this.scroll){
        //         if(underMouse.indexOf(listener.entity) !== -1){
        //             this.scroll.dispatch(listener, scroll, mouse.position);
        //         }
        //     }
        // }

        // for(const listener of this.mousehover){
        //     if(underMouse.indexOf(listener.entity) !== -1){
        //         this.mousehover.dispatch(listener, mouse.position);
        //     }
        // }

        // if(mouse.wasReleased("left")){
        //     for(const taplistener of this.taphandler){
        //         if(underMouse.indexOf(taplistener.entity) !== -1){
        //             this.taphandler.dispatch(taplistener, mouse.position);
        //         }
        //     } 
        // }

       

        
    }

}
