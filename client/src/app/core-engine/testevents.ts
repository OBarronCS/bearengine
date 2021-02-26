import { LevelHandler } from "shared/core/level";
import { Subsystem } from "shared/core/subsystem";
import { EngineMouse } from "../input/mouse";
import { BearEngine } from "./bearengine";

export class TestMouseDownEvent extends Subsystem<BearEngine> {
    


    init(): void {

    }

    private mousedown = this.addEventDispatcher("mousedown")

    update(delta: number): void {
        const mouse = this.getSystem(EngineMouse);
        const collision = this.getSystem(LevelHandler).collisionManager;


        const underMouse = collision.circleQuery(mouse.x, mouse.y, 1);

       
        for(const listener of this.mousedown){
            if(underMouse.indexOf(listener.entity) !== -1){
                this.mousedown.dispatch(listener, mouse.position)
            }
        }
    }

}
