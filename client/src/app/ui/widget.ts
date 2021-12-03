import { Color } from "shared/datastructures/color";
import { Vec2 } from "shared/shapes/vec2";
import { Graphics, Container, Text, Texture, Sprite } from "shared/graphics/graphics";
import { Rect } from "shared/shapes/rectangle";

export class UIManager {

    widgets: BearWidget[] = [];

    base_container: Container = new Container();

    addWidget<T extends BearWidget>(widget: T): T {
        this.widgets.push(widget);
        this.base_container.addChild(widget.container, widget.graphics);
        return widget;
    }


    update(mouse_position: Vec2, mouse_down: boolean, mouse_pressed: boolean, mouse_released: boolean, mouse_clicked: boolean){

        for(const w of this.widgets){
            this.mouse_hit_test(w, mouse_position, mouse_down, mouse_pressed, mouse_released, mouse_clicked);
        }
    }

    mouse_hit_test(w: BearWidget, mouse_position: Vec2, mouse_down: boolean, mouse_pressed: boolean, mouse_released: boolean, mouse_clicked: boolean){
        if(Rect.rectContains(w.x, w.y, w.width, w.height, mouse_position)){
            if(mouse_pressed) w.mouse_pressed();
            if(mouse_released) w.mouse_released();
            if(mouse_clicked) w.mouse_clicked();

            if(!w.mouse_in){
                w.mouse_in = true;
                w.mouse_enter();
            }

            for(const c of w.children) this.mouse_hit_test(c, mouse_position, mouse_down, mouse_pressed, mouse_released, mouse_clicked);
        } else if (w.mouse_in){
            w.mouse_in = false;
            w.mouse_leave();

            for(const c of w.children) { 
                console.log("NOT RECURSIVE")
                w.mouse_leave() 
            };
        }
    }

    render(){
        for(const w of this.widgets) w.render();
    }

}

type UISizeType = 
    | { type: "pixels", pixels: number }
    | { type: "percent", percent: number }

const uisize = {
    pixels(p:number){ return { type: "pixels", pixels: p } as const },
    percent(p: number){ return { type: "percent", percent: p } as const },
}

abstract class BearWidget {
    parent: BearWidget;
    children: BearWidget[] = [];
    position: Vec2; get x(){return this.position.x}; get y(){return this.position.y};
    width: number;
    height: number;

    background_color: Color = new Color([0,0,0,1]);

    container: Container = new Container();
    graphics: Graphics = new Graphics();

    mouse_in = false;

    constructor(pos: Vec2, width: number, height: number){
        this.position = pos;
        this.width = width;
        this.height = height;
    }

    render(){
        this.draw();
        for(const child of this.children){
            child.render();
        }
    }

    protected abstract draw(): void;

    abstract mouse_clicked(): void;
    abstract mouse_pressed(): void;
    abstract mouse_released(): void;

    abstract mouse_enter(): void;
    abstract mouse_leave(): void;


    addChild(widget: BearWidget){
        widget.parent = this;
        this.children.push(widget);

        this.container.addChild(widget.container, widget.graphics);
    }

    // abstract printableCharEvent(): void;
}

/** Null implementation */
abstract class BearWidgetAdapter extends BearWidget {

    mouse_clicked(): void {}
    mouse_pressed(): void {}
    mouse_released(): void {}
    mouse_enter(): void {}
    mouse_leave(): void {}
}

// Groups Widgets Together
export class PanelWidget extends BearWidgetAdapter {
    
    
    protected draw(): void {
        throw new Error("Method not implemented.");
    }

}


export class LabelWidget extends BearWidgetAdapter {
    text: string;

    text_render = new Text("")

    constructor(pos: Vec2, text: string){
        super(pos, 0, 0);

        this.text = text;

        this.container.addChild(this.text_render);
        this.text_render.position.set(pos.x, pos.y);
    }
    // font: FontType 
    protected draw(): void {
        this.text_render.text = this.text;
    }
}


export class ButtonWidget extends BearWidgetAdapter {
    
    draw_color = this.background_color.clone();
    hover_color = new Color([0,255,0,1])

    on_click_cb: () => void;

    constructor(pos: Vec2, width: number, height: number, cb: () => void){
        super(pos,width,height);
        this.on_click_cb = cb;
    }

    override mouse_pressed(){
        this.on_click_cb();
    }

    override mouse_enter(){
        this.draw_color.copyFrom(this.hover_color);
    }

    override mouse_leave(){
        this.draw_color.copyFrom(this.background_color)
    }

    protected draw(): void {
        this.graphics.beginFill(this.draw_color.hex(), this.draw_color.a);
        this.graphics.drawRect(this.x, this.y, this.width, this.height);
    }
}

/** ImagePanel */
export class SpriteWidget extends BearWidgetAdapter {
    
    sprite: Sprite;

    constructor(v: Vec2, t: Texture){
        super(v,0,0);
        this.sprite = new Sprite(t);
        this.sprite.position.set(v.x,v.y);
        this.container.addChild(this.sprite);
    }

    protected draw(): void {

    }

}

// OTHER WIDGETS:
// Checkbox, ColorPicker/ColorWheel, ProgressBar, Slider, WriteableTextBox
// Input for Array, Boolean, Vector

