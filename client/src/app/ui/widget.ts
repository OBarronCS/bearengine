import { Color } from "shared/datastructures/color";
import { Vec2 } from "shared/shapes/vec2";
import { Graphics, Container, Text, Texture, Sprite, TextMetrics, TextStyle } from "shared/graphics/graphics";
import { Rect } from "shared/shapes/rectangle";
import { Subsystem } from "shared/core/subsystem";
import { BearGame } from "shared/core/abstractengine";
import { BearEngine } from "../core-engine/bearengine";
import { drawPoint } from "shared/shapes/shapedrawing";

export class UIManager extends Subsystem<BearGame<BearEngine>> {
    
    private parent_widget: BearWidget;
    private base_container: Container = new Container();

    setBackgroundColor(color: Color){
        this.parent_widget.background_color.copyFrom(color);
    }
    
    
    addWidget<T extends BearWidget>(widget: T): T {
        this.parent_widget.addChild(widget);
        return widget;
    }
    
    clearUI(): void {        
        this.parent_widget.removeChildren();
    }
    
    init(){
        this.engine.renderer.addGUI(this.base_container);

        this.parent_widget = new PanelWidget(new Vec2(), this.game.engine.renderer.getPercentWidth(1),this.game.engine.renderer.getPercentHeight(1));
        this.base_container.addChild(this.parent_widget.container);

        this.engine.renderer.onresize((w,h)=>{
            this.parent_widget.width = this.game.engine.renderer.getPercentWidth(1);
            this.parent_widget.height = this.game.engine.renderer.getPercentHeight(1)
            this.parent_widget.resolvePosition();
        });
    }
    
    update(delta: number): void { 
        this.update_ui(this.engine.mouse.guiPosition, this.engine.mouse.isDown("left"), this.engine.mouse.wasPressed("left"), this.engine.mouse.wasReleased("left"), false);
        this.render();
    }

    update_ui(mouse_position: Vec2, mouse_down: boolean, mouse_pressed: boolean, mouse_released: boolean, mouse_clicked: boolean){
        this.mouse_hit_test(this.parent_widget, mouse_position, mouse_down, mouse_pressed, mouse_released, mouse_clicked);
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
        this.parent_widget.render();
    }

}

// type Alignment = "centered"
type UISizeType = 
    | { type: "pixels", pixels: number }
    | { type: "percent", percent: number }

/**
 * 
 * 
 * 
 */
type PositionInfo = {
    horz_centered: boolean,
    vert_centered: boolean,
    x: UISizeType,
    y: UISizeType
}


const uisize = {
    pixels(p:number){ return { type: "pixels", pixels: p } as const },
    percent(p: number){ return { type: "percent", percent: p } as const },
}

abstract class BearWidget {

    parent: BearWidget = null;
    children: BearWidget[] = [];

    protected position: Vec2; get x(){return this.position.x}; get y(){return this.position.y};
    
    readonly position_info: PositionInfo;

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

        this.container.sortableChildren = true;
        this.container.addChild(this.graphics);

        this.position_info = {
            x:{type:"pixels", pixels:pos.x},
            y:{type:"pixels", pixels:pos.y},
            horz_centered: false,
            vert_centered: false
        }
    }

    render(){
        this.graphics.clear();
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

        this.container.addChild(widget.container);
        widget.container.zIndex = this.container.zIndex + 1;
        
        this.container.sortChildren();
    }

    removeChildren() {
        this.container.removeChildren();
        this.children.forEach(c=>c.removeChildren());
        this.children = [];
    }
    
    setPosition(x: UISizeType, y: UISizeType){
        this.position.x = x.type === "pixels" ? x.pixels : (
            this.parent.width * x.percent);

        this.position.y = y.type === "pixels" ? y.pixels : (
            this.parent.height * y.percent);

        this.position_info.x = x;
        this.position_info.y = y;

        return this;
    }
    
    center(){
        this.position_info.horz_centered = true;
        this.position_info.vert_centered = true;
        this.position.x -= this.width / 2;
        this.position.y -= this.height / 2;
    }

    resolvePosition(){
        this.setPosition(this.position_info.x, this.position_info.y);
        if(this.position_info.horz_centered) this.center()
        this.children.forEach(c => c.resolvePosition());
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

/** Easy way to delete/add widgets at the same time, with no background until the panel */
export class WidgetGroup extends BearWidgetAdapter {
    protected draw(): void {}
}

/* Groups Widgets Together */
export class PanelWidget extends BearWidgetAdapter {
    
    
    protected draw(): void {
        this.graphics.beginFill(this.background_color.hex(), this.background_color.a);
        this.graphics.drawRect(this.x, this.y, this.width, this.height);
    }

}


export class LabelWidget extends BearWidgetAdapter {
    
    text: string;
    // font: FontType
    private text_style = new TextStyle({
        fontFamily: "Tahoma",
        stroke: "white",
        letterSpacing: 1,
        fontSize: 46 //36
    });

    text_render = new Text("", this.text_style);

    constructor(pos: Vec2, text: string){
        super(pos, 0, 0);

        this.text = text;
        this.text_render.text = text;

        this.container.addChild(this.text_render);
        this.text_render.position.set(pos.x, pos.y);
    }

    override setPosition(x: UISizeType, y: UISizeType): this {
        super.setPosition(x, y);
        this.text_render.position.copyFrom(this.position);
        return this;
    }

    override center(): void {
        super.center();
        const metrics = TextMetrics.measureText(this.text_render.text, this.text_style);
        this.position.x -= metrics.width / 2;
        this.position.y -= (metrics.height / 2) + 3 ;

        this.text_render.position.copyFrom(this.position);
    }

    setFontColor(color: Color){
        this.text_render.style.fill = color.hex();
    }

 
    protected draw(): void {
        // this.text_render.text = this.text;
        // drawPoint(this.graphics, this.position)
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

