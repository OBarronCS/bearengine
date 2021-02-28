import { LevelHandler } from "shared/core/level";
import { Subsystem } from "shared/core/subsystem";
import { EngineMouse } from "../input/mouse";
import { BearEngine } from "./bearengine";

export class TestMouseDownEventDispatcher extends Subsystem<BearEngine> {
    
    init(): void {}

    private taphandler = this.addEventDispatcher("tap");
    private mousedown = this.addEventDispatcher("mousehover");


    update(delta: number): void {
        const mouse = this.getSystem(EngineMouse);
        const collision = this.getSystem(LevelHandler).collisionManager;


        const underMouse = collision.circleQuery(mouse.x, mouse.y, 1);

       
        for(const listener of this.mousedown){
            if(underMouse.indexOf(listener.entity) !== -1){
                this.mousedown.dispatch(listener, mouse.position)
            }
        }

        if(mouse.wasReleased("left")){
            for(const taplistener of this.taphandler){
                if(underMouse.indexOf(taplistener.entity) !== -1){
                    this.taphandler.dispatch(taplistener, mouse.position);
                }
            }
                
        }



    }

}
