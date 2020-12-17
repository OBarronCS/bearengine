import { BearEngine } from "./core-engine/bearengine";
import { DropTarget } from "./apiwrappers/draganddrop";
import { Texture, BaseTexture, Sprite, Point, resources } from "pixi.js";
import { Vec2 } from "../../../shared/shapes/vec2";
import { Polygon } from "../../../shared/shapes/polygon";
import { StartFullscreen } from "./apiwrappers/fullscreen";
import { E } from "./core-engine/globals";
import { LockMouse } from "./apiwrappers/pointerlock";
import { LockKeys } from "./apiwrappers/keyboardapiwrapper";
import { CustomMapFormat } from "../../../shared/core/tiledmapeditor";
import { LinkedStack } from "../../../shared/datastructures/stack";
import { ArrayQueue, LinkedQueue } from "../../../shared/datastructures/queue";
import { RandomizedBag } from "../../../shared/datastructures/randomizedbag";


const game = new BearEngine({
    popup : false
});

// Loads assets from server
game.preload().then(RESOURCES => {
    console.log("PRELOAD FINISHED")
    game.startLevel(RESOURCES["images/level.json"].data as CustomMapFormat)
    game.start()
})

E.Keyboard.bind("p",() => {
    StartFullscreen(document,game.renderer.pixiapp.renderer.view);

    //LockMouse(document,game.renderer.pixiapp.renderer.view);
});

E.Keyboard.bind("r",() => {
    game.restartCurrentLevel();
    //LockMouse(document,game.renderer.pixiapp.renderer.view);
});

LockKeys([
    "KeyW", 
    "KeyA", 
    "KeyS", 
    "KeyD",
    //"Escape"
]);


// Testing drag and drop!
const element = game.renderer.pixiapp.renderer.view

initDropTarget(element)
// Same div as the one the PIXI app is on
function initDropTarget(id:string|HTMLElement){

    /// @ts-ignore
    const dropTarget = new DropTarget(id)
    dropTarget.enable();

    dropTarget.onDrop((files,e) => {
        let num = -1;
        for(const file of files){
            if(file.name.endsWith("json") || file.name.endsWith("custom")){
                file.text().then(string => {
                    // string is the raw level data from the file
                    game.endCurrentLevel();
                    game.startLevel(JSON.parse(string));
                })
            }

            else if(file.type.startsWith("image")){
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
                    game.renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

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
                    game.renderer.pixiapp.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

                    spr.position = game.renderer.mainContainer.toLocal(point);
                    spr.position.x += num * 500;
                    URL.revokeObjectURL(url);
                });

                vid.src = url;
                setTimeout(() => console.log(vid),10)
            }
        }
    })
}



