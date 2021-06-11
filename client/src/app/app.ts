import { BearEngine } from "./core-engine/bearengine";
import { DropTarget } from "./apiwrappers/draganddrop";
import { Texture, BaseTexture, Sprite, Point, resources } from "pixi.js";
import { LockKeys } from "./apiwrappers/keyboardapiwrapper";
import { ParseTiledMapData, TiledMap } from "shared/core/tiledmapeditor";
import { CreateLevel } from "./core-engine/gamelevel";
import { Player } from "./gamelogic/player";
import { Entity } from "./core-engine/entity";
import { SpritePart } from "./core-engine/parts";
import { ColliderPart } from "shared/core/abstractpart";
import { dimensions } from "shared/shapes/rectangle";
import { bearevent } from "shared/core/bearevents";
import { Vec2 } from "shared/shapes/vec2";

const game = new BearEngine();

game.init();
game.loadAssets().then(RESOURCES => {
    dragAndDropTest(game.renderer.renderer.view);
    
    const levelone = CreateLevel("assets/firsttest.json", { 
        start(engine){
            engine.entityManager.addEntity(new Player());

            class TestEntityForVideo extends Entity {
        
                private sprite = this.addPart(new SpritePart("tree.gif"));
                private collider = this.addPart(new ColliderPart(dimensions(200,200), Vec2.ZERO));
        
                update(dt: number): void {
                    
                }
        
                // @bearevent("mousehover", {})
                daisvfdakusvdjasd(point: Vec2){
                    console.log("Hello, i was hovered", point.toString());
                }
        
                //@bearevent("tap", {})
                ontapcallback(num: Vec2){
                    console.log("I was clicked")
                }
        
                @bearevent("mousedown", { button: "left"})
                asdasdasdasd(point: Vec2){
                    console.log("HEOLLO")
                }
        
                @bearevent("scroll", {})
                asdasd(scroll: number, point: Vec2){
                    console.log(scroll)
                }
        
            }

            const test = new TestEntityForVideo();
            
            engine.entityManager.addEntity(test);

        }, 
        end(engine){
            
        }  
    });

    game.loadLevel(levelone);
    
    // game.loadFrameEditor();
    game.start();
})


function JSMapToString(map: Map<any, any>): string {

    let str = "";

    for(const [key, value] of map){
        str += `[${key}:${value}],`
    }


    return str;
}

LockKeys([
    "KeyW", 
    "KeyA", 
    "KeyS", 
    "KeyD",
    //"Escape"
]);

// Testing drag and drop!
function dragAndDropTest(element: HTMLCanvasElement){

    initDropTarget(element)

    function initDropTarget(id:string|HTMLElement){

        const dropTarget = new DropTarget(id)
        dropTarget.enable();
        
        dropTarget.onDrop((files,e) => {
            let num = -1;
            for(const file of files){
                if(file.name.endsWith("json") || file.name.endsWith("custom")){
                    file.text().then(string => {
                        // string is the raw level data from the file
                        game.endCurrentLevel();

                        const p = CreateLevel(JSON.parse(string) as TiledMap, { start(engine){}, end(engine){} });
                        game.loadLevel(p);
                    });
                } else if(file.type.startsWith("image")){
                    const img = new Image();
                    const url = URL.createObjectURL(file);

                    img.addEventListener("load", function(){
                        num += 1;
                        const texture = new Texture(new BaseTexture(img));
                        const spr = new Sprite(texture);
                        game.renderer.addSprite(spr);

                        // Found this in pixi.js interaction manager source code 
                        // --> mapPositionToPoint --> maps CSS point to PIXI Canvas point
                        // then i need to convert that to the container point so things get dropped on the mouse
                        const point = new Point(0,0);
                        game.renderer.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

                        spr.position = game.renderer.mainContainer.toLocal(point);
                        spr.position.x += num * 500;
                        URL.revokeObjectURL(url);
                    });

                    img.src = url;
                } else if(file.type.startsWith("video")){
                    const vid = document.createElement('video');

                    const url = URL.createObjectURL(file);

                    // each type of element has unique events -->
                    // video does not have "load" event
                    // but others because videos have to buffer
                    //https://www.w3schools.com/tags/ref_av_dom.asp
                    vid.addEventListener("canplaythrough", function(){
                        console.log("LOADED")
                        num += 1;
                        const videoTexture = new resources.VideoResource(vid);
                        const texture = new Texture(new BaseTexture(videoTexture));
                        const spr = new Sprite(texture);
                        game.renderer.addSprite(spr);

                        const point = new Point(0,0);
                        game.renderer.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

                        spr.position = game.renderer.mainContainer.toLocal(point);
                        spr.position.x += num * 500;
                        URL.revokeObjectURL(url);
                    });

                    vid.src = url;
                    //setTimeout(() => console.log(vid),10)
                }
            }
        })
    }
} 


