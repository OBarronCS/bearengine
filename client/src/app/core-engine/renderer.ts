import { autoDetectRenderer, Renderer, Container, DisplayObject, utils, InteractionManager } from "pixi.js";
import { clamp } from "shared/mathutils";
import { BearEngine } from "./bearengine";
import { GraphicsPart, SpritePart } from "./parts";
import { Subsystem } from "shared/core/subsystem";
import { Color } from "shared/datastructures/color";


// arbitrary, but make it high enough so it looks good --> this is the base render texture height!
// so things are actually rendered to THIS resolution, and then the entire canvas is scaled
const DEFAULT_RESOLUTION_HEIGHT = 1200 //768;

const MIN_RATIO = 4/3;
const MAX_RATIO = 21/9;

//https://pixijs.download/dev/docs/PIXI.utils.html#.isMobile
const isMobile = utils.isMobile.any;

export class RendererSystem extends Subsystem<BearEngine> {
    public renderer: Renderer;

    public stage = new Container();
    public guiContainer = new Container();
    public mainContainer = new Container();
    
    public targetWindow: Window;
    public targetDiv: HTMLElement;

    private graphics_query = this.addQuery(GraphicsPart,
            g => {
                g.graphics.zIndex = 1;
                this.addSprite(g.graphics)
                },
            g => this.removeSprite(g.graphics)
        );

    private sprite_query = this.addQuery(SpritePart,
            s => {
                if(s.file_path !== ""){
                    s.sprite.texture = this.getTexture(s.file_path);
                }
                this.addSprite(s.sprite)
            },
            s => {
                this.removeSprite(s.sprite);
            
                s.sprite.destroy({
                    children: true,
                    baseTexture: false,
                    texture: false
            });
        });

    constructor(engine: BearEngine, targetDiv: HTMLElement, targetWindow: Window){
        super(engine);
        this.targetWindow = targetWindow;
        this.targetDiv = targetDiv;
        document.body.style.zoom = "1.0"
        
        // These numbers mean nothing --> the second the screen is resized in the fitToScreen call
        // these are overridden
        const width = targetWindow.innerWidth;
        const height = targetWindow.innerHeight;

        this.renderer = autoDetectRenderer({
            width: width, 
            height: height, 
            //autoDensity:true, --> i have no idea what this does
            //maybe something to do with mac (retina) display have 2x pixel resolution
        });

        targetDiv.style.transformOrigin = "0 0";
        targetDiv.style.margin = 0 + "px";
        targetDiv.style.padding = 0 + "px";

        this.fitToScreen();

        targetDiv.appendChild(this.renderer.view);

        this.targetWindow.onresize = (e) => this.fitToScreen();
        

        this.mainContainer.zIndex = 0;
        this.mainContainer.sortableChildren = true;

        this.guiContainer.zIndex = 100;

        this.stage.addChild(this.mainContainer);
        this.stage.addChild(this.guiContainer);

        //this.setCursorSprite("assets/flower.png")
    }

    setCursorSprite(path: string){
        // css format: 
        // "url('assets/flower.png'),auto";
        const css = `url('${path}'),auto`;
        (this.renderer.plugins.interaction as InteractionManager).cursorStyles.default = css;
    }

    setBackgroundColor(color: Color){
        this.renderer.backgroundColor = color.hex()
    }

    init(){}

    update(){
        for(const sprite of this.sprite_query){
            sprite.sprite.position.copyFrom(sprite.owner.position);
        }

        this.renderer.render(this.stage);
    }

    addGUI<T extends DisplayObject>(sprite: T){
        this.guiContainer.addChild(sprite)
        return sprite
    }

    removeGUI<T extends DisplayObject>(sprite: T){
        this.guiContainer.removeChild(sprite)
        return sprite
    }

    addSprite<T extends DisplayObject>(sprite: T){
        this.mainContainer.addChild(sprite)
        return sprite
    }
        
    removeSprite<T extends DisplayObject>(sprite:T){
        this.mainContainer.removeChild(sprite)
        return sprite;
    }
    
    private fitToScreen(){
        // this is wrong if zoom in on chrome, or on a macbook.
        // use this to scale accordingly
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio

        // works in fullscreen perfeclty
        const window_width = this.targetWindow.innerWidth;
        const window_height = this.targetWindow.innerHeight;

        console.log(window_width, window_height)

        // console.log(window_width, window_height)

        // First, clamp by height
        // if not enough width for that, clamp by width
        let ideal_width = 0;
        let ideal_height = window_height // or whatever I want

        // clamped aspect ratio
        let aspect_ratio = window_width / window_height;
        aspect_ratio = clamp(aspect_ratio, MIN_RATIO, MAX_RATIO);

        ideal_width = Math.round(ideal_height * aspect_ratio);
        if(ideal_width % 2 != 0) ideal_width--;

        if(ideal_width > window_width){
            ideal_width = window_width;
            ideal_height = 0 // or whatever I want
    
            // clamped aspect ratio
            ideal_height = Math.round(ideal_width / aspect_ratio);
    
            if(ideal_height % 2 != 0) ideal_height--;
        }
        // Its important that the view and the actual surface have the same aspect ratio
        // so nothing gets scaled wierd

        const new_surface_width = aspect_ratio * DEFAULT_RESOLUTION_HEIGHT;
        const new_surface_height = DEFAULT_RESOLUTION_HEIGHT;

        this.renderer.resize(new_surface_width, new_surface_height);
        
        // console.log(ideal_width,ideal_height)

        this.renderer.view.style.width = ideal_width  + 'px';
        this.renderer.view.style.height = ideal_height  + 'px';
    }
     
    getTexture(_name: string){
        const _str = _name;
        return this.engine.getResource(_str).texture;
    }
    
    getPercentWidth(percent: number){
        return percent * this.renderer.view.width;
    }
    
    getPercentHeight(percent: number){
        return percent * this.renderer.view.height;
    }
}


