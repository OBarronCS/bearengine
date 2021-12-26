import { Color } from "shared/datastructures/color";
import { Vec2 } from "shared/shapes/vec2";
import { Graphics, Container, Text, Texture, Sprite, TextMetrics, TextStyle } from "shared/graphics/graphics";
import { Rect } from "shared/shapes/rectangle";
import { Subsystem } from "shared/core/subsystem";
import { BearGame } from "shared/core/abstractengine";
import { BearEngine } from "../core-engine/bearengine";

export class UIManager extends Subsystem<BearGame<BearEngine>> {
    
    private parent_widget: BearWidget;
    private base_container: Container = new Container();

    setBackgroundColor(color: Color){
        this.parent_widget.background_color.copyFrom(color);
        this.parent_widget.markDirty();
    }
    
    clearBackground(){
        this.parent_widget.background_color.copyFrom(new Color([0,0,0,0]));
        this.parent_widget.markDirty();
    }
    
    
    addWidget<T extends BearWidget>(widget: T): T {
        this.parent_widget.addChild(widget);
        return widget;
    }

    removeWidget<T extends BearWidget>(widget: T): T {
        this.parent_widget.removeChild(widget);
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
            
            this.parent_widget.setSize({type:"pixels", pixels: w}, {type:"pixels", pixels: h});

            // Recursively resolve all positions given the new canvas size
            this.parent_widget.resolvePosition();
            
            // Forces all the UI to be redraw
            this.parent_widget.markDirty();
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
                w.markDirty();
            }

            for(const c of w.children) this.mouse_hit_test(c, mouse_position, mouse_down, mouse_pressed, mouse_released, mouse_clicked);
        } else if (w.mouse_in){
            w.mouse_in = false;
            w.mouse_leave();
            w.markDirty();
            for(const c of w.children) { 
                console.log("NOT RECURSIVE");
                w.mouse_leave() 
            };
        }
    }

    render(){
        if(this.parent_widget.dirty){
            this.parent_widget.resolvePosition();
            this.parent_widget.render();
        }
    }

}

// type Alignment = "centered"
type UISizeType = 
    | { type: "pixels", pixels: number } // absolute size
    | { type: "percent", percent: number } // relative to parent size.

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

type SizeInfo = {
    width: UISizeType,
    height: UISizeType;
}

// widget --> parent-width

const uisize = {
    pixels(p:number){ return { type: "pixels", pixels: p } as const },
    percent(p: number){ return { type: "percent", percent: p } as const },
}

abstract class BearWidget {

    parent: BearWidget = null;
    children: BearWidget[] = [];

    protected position: Vec2; get x(){return this.position.x}; get y(){return this.position.y};
    
    width: number;
    height: number;

    readonly position_info: PositionInfo;
    readonly size_info: SizeInfo;

    private visible = true;

    dirty = false;



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
        };

        this.size_info = {
            width:{type:"pixels", pixels:width},
            height:{type:"pixels", pixels:height},
        }
    }

    render(){
        this.graphics.clear();
        if(this.visible){
            this.draw();
            for(const child of this.children){
                child.render();
            }
        } 
    }

    protected abstract draw(): void;

    abstract mouse_clicked(): void;
    abstract mouse_pressed(): void;
    abstract mouse_released(): void;

    abstract mouse_enter(): void;
    abstract mouse_leave(): void;


    addChild<T extends BearWidget>(widget: T): T {
        widget.parent = this;
        this.children.push(widget);

        this.container.addChild(widget.container);
        widget.container.zIndex = this.container.zIndex + 1;
        this.container.sortChildren();

        this.markDirty();

        return widget;
    }

    removeChild(w: BearWidget) {
        const index = this.children.indexOf(w);
        if(index !== -1){
            this.container.removeChild(w.container);
        
            this.children.splice(index,1)
    
            this.markDirty();
        }
        
    }

    removeChildren() {
        this.container.removeChildren();
        this.children.forEach(c=>c.removeChildren());
        this.children = [];

        this.markDirty();
    }
    
    setPosition(x: UISizeType, y: UISizeType): this {
        this.markDirty();

        this.position_info.x = x;
        this.position_info.y = y;

        return this;
    }

    setSize(w: UISizeType, h: UISizeType): this {
        this.markDirty();

        this.size_info.width = w;
        this.size_info.height = h
        return this;
    }
    
    center(): this {
        this.position_info.horz_centered = true;
        this.position_info.vert_centered = true;
        this.position.x -= this.width / 2;
        this.position.y -= this.height / 2;

        return this;
    }


    markDirty(){
        this.dirty = true;
        if(this.parent !== null) this.parent.markDirty();
    }

    resolvePosition(){

        const {x,y} = this.position_info;
        
        this.position.x = x.type === "pixels" ? x.pixels : (
            this.parent.width * x.percent);

        this.position.y = y.type === "pixels" ? y.pixels : (
            this.parent.height * y.percent);

        const {width,height} = this.size_info;

        this.width = width.type === "pixels" ? width.pixels : (
            this.parent.width * width.percent);

        this.height = height.type === "pixels" ? height.pixels : (
            this.parent.height * height.percent);

        if(this.position_info.horz_centered) this.center()
        
        this.dirty = false;

        this.container.position.copyFrom(this.position)
        
        this.children.forEach(c => c.resolvePosition());
    }

    // abstract printableCharEvent(): void;

    setVisible(visible: boolean){
        this.visible = visible;
        this.container.visible = this.visible;
        this.markDirty();
    }

    toggleVisible(){
        this.visible = !this.visible;
        this.container.visible = this.visible;
        this.markDirty();
    }

}

/** Null implementation */
abstract class BearWidgetAdapter extends BearWidget {
    mouse_clicked(): void {}
    mouse_pressed(): void {}
    mouse_released(): void {}
    mouse_enter(): void {}
    mouse_leave(): void {}
}

/** Easy way to delete/add widgets at the same time, with no background unlike the panel 
 *  Has the width/height of its parent
*/
export class WidgetGroup extends BearWidgetAdapter {
    constructor(pos: Vec2){
        super(pos, 0, 0);

        this.setSize({type:"percent", percent:1}, {type:"percent", percent:1})
    }

    protected draw(): void {}
}

/* Groups Widgets Together */
export class PanelWidget extends BearWidgetAdapter {
    
    protected draw(): void {
        this.graphics.beginFill(this.background_color.hex(), this.background_color.a);
        this.graphics.drawRect(0, 0, this.width, this.height);
    }
}


export class LabelWidget extends BearWidgetAdapter {
    
    private text: string;

    setText(str: string){
        this.markDirty();
        this.text = str;
    }

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
        return this;
    }

    override center(): this {
        super.center();
        const metrics = TextMetrics.measureText(this.text_render.text, this.text_style);
        this.position.x -= metrics.width / 2;
        this.position.y -= (metrics.height / 2) + 3 ;
        
        return this;
    }

    setFontColor(color: Color){
        this.text_render.style.fill = color.hex();
    }

 
    protected draw(): void {
        this.text_render.text = this.text;
        // drawPoint(this.graphics, this.position)
    }
}

export class ExpandingTextPanel extends BearWidgetAdapter {

    y_offset = 0;

    constructor(pos: Vec2){
        super(pos, 0, 0);
    }

    addTextField(initial_string: string){
        const text = new Text(initial_string);
        text.y = this.y_offset;
        this.y_offset += text.height + 1;

        this.container.addChild(text);
        return text;
    }

    protected draw(): void {

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
        this.graphics.drawRect(0,0, this.width, this.height);
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

