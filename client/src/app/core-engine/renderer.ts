import { Container, DisplayObject, Loader, Application, utils, Texture, Sprite, TextureLoader } from "pixi.js";
import { PartQuery } from "shared/core/partquery";
import { GraphicsPart } from "./parts";


const SHARED_RESOURCES = Loader.shared.resources;
const SHARED_LOADER = Loader.shared;


// arbitrary, but make it high enough so it looks good --> this is the base render texture height!
// so things are actually rendered to THIS resolution
const DEFAULT_RESOLUTION_HEIGHT = 1200 //768;

const MIN_RATIO = 4/3;
const MAX_RATIO = 21/9;

//https://pixijs.download/dev/docs/PIXI.utils.html#.isMobile
const isMobile = utils.isMobile.any;

export class Renderer {
    public pixiapp: Application;


    public guiContainer: Container = new Container();
    public mainContainer: Container = new Container();
    
    public targetWindow: Window;
    public targetDiv: HTMLElement;

    public partQuery = new PartQuery(GraphicsPart,
            g => this.addSprite(g.graphics),
            g => this.removeSprite(g.graphics))

    constructor(targetDiv: HTMLElement, targetWindow: Window){
        this.targetWindow = targetWindow;
        this.targetDiv = targetDiv;
        document.body.style.zoom = "1.0"
        
        // These numbers mean nothing --> the second the screen is resized in the fitToScreen call
        // these are overridden
        let width = targetWindow.innerWidth;
        let height = targetWindow.innerHeight;

        const bgColor: string = "#bfbdae";

        this.pixiapp = new Application({
            width: width, 
            height: height, 
            backgroundColor : utils.string2hex(bgColor),
            //autoDensity:true, --> pixi docs are pretty bad --> i have no idea what this does
            //maybe something to do with mac (retina) display have 2x pixel resolution
            autoStart: false
        });

        //document.body.style.backgroundColor = bgColor;
        this.fitToScreen()
    
        targetDiv.style.transformOrigin = "0 0";
        targetDiv.style.margin = 0 + "px";
        targetDiv.style.padding = 0 + "px";

        targetDiv.appendChild(this.pixiapp.view);


        this.targetWindow.onresize = (e) => this.fitToScreen();
        

        this.setCursorSprite("images/flower.png")
            

        this.mainContainer.zIndex = 0;
        this.mainContainer.sortableChildren = true;

        this.guiContainer.zIndex = 100

        this.pixiapp.stage.addChild(this.mainContainer);
        this.pixiapp.stage.addChild(this.guiContainer);
    }

    setCursorSprite(path: string){
        // format: 
        // "url('images/flower.png'),auto";
        const css = `url('${path}'),auto`
        this.pixiapp.renderer.plugins.interaction.cursorStyles.default = css;
    }

    update(delta_s: number){
        // Draws the stage to the screen!
        this.pixiapp.renderer.render(this.pixiapp.stage)
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
        let window_width = this.targetWindow.innerWidth;
        let window_height = this.targetWindow.innerHeight;

        console.log(window_width, window_height)

        // console.log(window_width, window_height)

        // First, clamp by height
        // if not enough width for that, clamp by width
        let ideal_width = 0;
        let ideal_height = window_height // or whatever I want

        // clamped aspect ratio
        let aspect_ratio = window_width / window_height;
        aspect_ratio = Math.min(Math.max(aspect_ratio, MIN_RATIO), MAX_RATIO)

        ideal_width = Math.round(ideal_height * aspect_ratio) 
        if(ideal_width % 2 != 0) ideal_width--;

        if(ideal_width > window_width){
            ideal_width = window_width;
            ideal_height = 0 // or whatever I want
    
            // clamped aspect ratio
            ideal_height = Math.round(ideal_width / aspect_ratio) 
    
            if(ideal_height % 2 != 0) ideal_height--;
        }
        // Its important that the view and the actual surface have the same aspect ratio
        // so nothing gets scaled wierd

        const new_surface_width = aspect_ratio * DEFAULT_RESOLUTION_HEIGHT;
        const new_surface_height = DEFAULT_RESOLUTION_HEIGHT;

        this.pixiapp.renderer.resize(new_surface_width, new_surface_height);
        
        // console.log(ideal_width,ideal_height)

        this.pixiapp.renderer.view.style.width = ideal_width  + 'px';
        this.pixiapp.renderer.view.style.height = ideal_height  + 'px';
    }
     
    getTexture(_name: string){
        const _str = _name 
        return SHARED_RESOURCES[_str].texture
    }
    
    getPercentWidth(percent: number){
        return percent * this.pixiapp.renderer.view.width
    }
    
    getPercentHeight(percent: number){
        return percent * this.pixiapp.renderer.view.height
    }

    get mouse(){
        return this.pixiapp.renderer.plugins.interaction.mouse.global
    }
}


