import { Container, Text, Graphics, Sprite, Texture } from "shared/graphics/graphics";
import { Coordinate } from "shared/shapes/vec2";


export class UIBox  {
    
    
    private container = new Container();

    constructor(public box_width: number, public box_height: number){

    }

    set position(pos: Coordinate){
        this.container.position.copyFrom(pos);
    }

    get position(){
        return this.container.position;
    }

    drawTexture(texture: Texture, pos: Coordinate){
        const s = new Sprite(texture);

        this.container.addChild(s);

        s.position.copyFrom(pos);
    }

    drawText(text: string, pos: Coordinate){
        const t = new Text(text);

        this.container.addChild(t);

        t.position.copyFrom(pos);
    }


    addToContainer(container: Container){
        container.addChild(this.container);
    }

}

