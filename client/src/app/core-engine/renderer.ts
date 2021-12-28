import { autoDetectRenderer, Renderer, Container, DisplayObject, utils, InteractionManager, Graphics, Sprite, Texture, AbstractRenderer, ParticleContainer } from "shared/graphics/graphics";
import { clamp, E } from "shared/misc/mathutils";
import { BearEngine } from "./bearengine";
import { GraphicsPart, SpritePart } from "./parts";
import { Subsystem } from "shared/core/subsystem";
import { Color } from "shared/datastructures/color";

import { Emitter, EmitterConfigV1, EmitterConfigV2, EmitterConfigV3, upgradeConfig } from "shared/graphics/particles";
import { BearGame } from "shared/core/abstractengine";


// arbitrary, but make it high enough so it looks good --> this is the base render texture height!
// so things are actually rendered to THIS resolution, and then the entire canvas is scaled
const DEFAULT_RESOLUTION_HEIGHT = 1200 //768;

const MIN_RATIO = 4/3;
const MAX_RATIO = 21/9;

//https://pixijs.download/dev/docs/PIXI.utils.html#.isMobile
const isMobile = utils.isMobile.any;

type OnResizeCallback = ((width:number, height: number) => void);

export class RendererSystem {


    public renderer: AbstractRenderer;

    public stage = new Container();
    public guiContainer = new Container();
    public mainContainer = new Container();

    private particle_container = new ParticleContainer(1500*6,{})
    
    public targetWindow: Window;
    public targetDiv: HTMLElement;

    private emitters: Emitter[] = [];

    private on_resize_callbacks: OnResizeCallback[] = [];

    addEmitter(path: string, settings: EmitterConfigV1 | EmitterConfigV3, x: number, y: number): Emitter {
        const newVersionSettings = upgradeConfig(settings, this.getTexture(path));
        //@ts-expect-error --> another type issue with pixi-particle-emitter... 
        const e = new Emitter(this.particle_container, newVersionSettings);

        e.emit = true;

        // console.log(e);

        //e["_completeCallback"]

        e.updateSpawnPos(x, y);

        this.emitters.push(e);

        return e;
    }

    onresize(cb: OnResizeCallback){
        this.on_resize_callbacks.push(cb);
    }

    engine: BearEngine;
    constructor(engine: BearEngine, targetDiv: HTMLElement, targetWindow: Window){
        this.engine = engine;
        this.targetWindow = targetWindow;
        this.targetDiv = targetDiv;
        
        //document.body.style.zoom = "1.0"
        
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

        this.targetWindow.addEventListener("resize", (e) => this.fitToScreen());
        

        this.mainContainer.zIndex = 0;
        this.mainContainer.sortableChildren = true;

        this.mainContainer.addChild(this.particle_container)


        this.guiContainer.zIndex = 100;

        this.stage.addChild(this.mainContainer);
        this.stage.addChild(this.guiContainer);
        

        //this.setCursorSprite("assets/flower.png");

        // Stops right click menu
        this.renderer.view.addEventListener('contextmenu', function(ev) {
            ev.preventDefault();
            return false;
        }, false);
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


    updateParticles(dt: number){
        // To remove emitters once they are dead
        // Should have _destroyWhenComplete() set to true. Or call
        // for(let i = this.emitters.length - 1; i > 0;i--){
        //     const e = this.emitters[i];
        //     e.update(dt);
        //     if (!e.emit && !e["_activeParticlesFirst"]) {
        //          e.destroy()
        //         this.emitters.pop();
        //     }
        // }

        for(const emitter of this.emitters){
            emitter.update(dt);
        }
    }

    update(){

        this.renderer.render(this.stage);
        
    }

    addGUI<T extends DisplayObject>(container: T){
        this.guiContainer.addChild(container)
        return container
    }

    removeGUI<T extends DisplayObject>(container: T){
        this.guiContainer.removeChild(container)
        return container
    }

    addSprite<T extends DisplayObject>(container: T){
        this.mainContainer.addChild(container)
        return container
    }
        
    removeSprite<T extends DisplayObject>(container:T){
        this.mainContainer.removeChild(container)
        return container;
    }

    createGUICanvas(){
        const graphics = new Graphics();
        this.addGUI(graphics);
        return graphics;
    }

    /** Returns empty graphics object that has been added to the scene. Call destroy() to remove it */
    createCanvas(){
        const graphics = new Graphics();
        this.addSprite(graphics);
        return graphics;
    }

    /** Returns a new sprite with given texture. Call destroy() to remove it */
    createSprite(path: string){
        const spr = new Sprite(this.getTexture(path));
        this.addSprite(spr);
        return spr;
    }
    
    private fitToScreen(){
        // this is wrong if zoom in on chrome, or on a macbook.
        // use this to scale accordingly
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio

        // works in fullscreen perfeclty
        const window_width = this.targetWindow.innerWidth;
        const window_height = this.targetWindow.innerHeight;

        //console.log(window_width, window_height);

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

        // Changes the underlying texture size
        this.renderer.resize(new_surface_width, new_surface_height);
        
        // console.log(ideal_width,ideal_height)

        // Changes the actual viewport on the web browser
        this.renderer.view.style.width = ideal_width  + 'px';
        this.renderer.view.style.height = ideal_height  + 'px';

        this.on_resize_callbacks.forEach(cb => cb(new_surface_width, new_surface_height));
    }
     
    clear(){


        // Must delete emitters first, because the particles are contained in the mainContainer
        for(const emitter of this.emitters){
            emitter.destroy();
        }

        this.emitters = [];


        // this.mainContainer.destroy();
        // this.guiContainer.destroy();

        // const children = this.mainContainer.removeChildren();
        // const moreChildren = this.guiContainer.removeChildren();

        // // This is crucial --> otherwise there is a memory leak
        // children.forEach(child => child.destroy());
        // moreChildren.forEach(child => child.destroy());
    }
 

    getTexture(_name: string){
        const _str = _name === "" ? "blank_string_sprite.png" : _name;

        const tex_data = this.engine.getResource(_str);

        if(tex_data === undefined){
            return this.engine.getResource("missing_texture.png").texture;
        }

        return tex_data.texture;
    }
    
    //These functions return the width of the underlying canvas texture
    //Despite saying "view". 
    //view.style is the css pixels
    getPercentWidth(percent: number){
        return percent * this.renderer.view.width;
    }
    
    getPercentHeight(percent: number){
        return percent * this.renderer.view.height;
    }
}



export class DefaultEntityRenderer extends Subsystem<BearGame<BearEngine>> {

    private renderer = this.game.engine.renderer;

    private graphics_query = this.addQuery(GraphicsPart,
        g => {
            g.graphics.zIndex = 1;
            this.renderer.addSprite(g.graphics)
            },
        g => this.renderer.removeSprite(g.graphics)
    );


    private sprite_query = this.addQuery(SpritePart,
            s => {
                if(s.file_path !== ""){
                    s.sprite.texture = this.renderer.getTexture(s.file_path);
                }
                this.renderer.addSprite(s.sprite)
            },
            s => {
                this.renderer.removeSprite(s.sprite);
            
                s.sprite.destroy({
                    children: true,
                    baseTexture: false,
                    texture: false
            });
        });

    init(): void {}

    update(delta: number): void {
        for(const sprite of this.sprite_query){
            sprite.sprite.position.copyFrom(sprite.owner.position);
        }
    }

    clear(){
        this.renderer.clear();
    }


}
