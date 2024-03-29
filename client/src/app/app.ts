import { BearEngine, NetworkPlatformGame } from "./core-engine/bearengine";
import { LockKeys } from "./apiwrappers/keyboardapiwrapper";
import { Trie } from "shared/datastructures/trie";

// import "shared/testing/entitysystemtest";
// RunTests();


const t = new Trie();
t.insertAll(["Banana", "Billy", "Baaaaa", "Bam", "Baam"]);
console.log(t.autocomplete(""))
console.log(t.autocomplete("ba"))

const engine = new BearEngine();

engine.init();
engine.loadAssets().then(RESOURCES => {
    // dragAndDropTest(engine.renderer.renderer.view);

    const game = new NetworkPlatformGame(engine);
    engine.start(game);
    


    
    //engine.start(new FrameEditor(engine))
})

LockKeys([
    "KeyW", 
    "KeyA", 
    "KeyS", 
    "KeyD",
    //"Escape"
]);


type BrandedIDType<B> = number & { readonly B: never } & {_type?: B};

type Hello = BrandedIDType<"Hello">;
type No = BrandedIDType<"Noasdasd">;

const id1: Hello = 1 as Hello;
let id2: No = 23 as No;

// // Testing drag and drop!
// function dragAndDropTest(element: HTMLCanvasElement){

//     initDropTarget(element)

//     function initDropTarget(id:string|HTMLElement){

//         const dropTarget = new DropTarget(id)
//         dropTarget.enable();
        
//         dropTarget.onDrop((files,e) => {
//             let num = -1;
//             for(const file of files){
//                 if(file.name.endsWith("json") || file.name.endsWith("custom")){
//                     file.text().then(string => {
//                         // string is the raw level data from the file
//                         engine.endCurrentLevel();

//                         const p = new DummyLevel(JSON.parse(string) as TiledMap);
//                         engine.loadLevel(p);
//                     });
//                 } else if(file.type.startsWith("image")){
//                     const img = new Image();
//                     const url = URL.createObjectURL(file);

//                     img.addEventListener("load", function(){
//                         num += 1;
//                         const texture = new Texture(new BaseTexture(img));
//                         const spr = new Sprite(texture);
//                         engine.renderer.addSprite(spr);

//                         // Found this in pixi.js interaction manager source code 
//                         // --> mapPositionToPoint --> maps CSS point to PIXI Canvas point
//                         // then i need to convert that to the container point so things get dropped on the mouse
//                         const point = new Point(0,0);
//                         engine.renderer.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

//                         spr.position = engine.renderer.mainContainer.toLocal(point);
//                         spr.position.x += num * 500;
//                         URL.revokeObjectURL(url);
//                     });

//                     img.src = url;
//                 } else if(file.type.startsWith("video")){
//                     const vid = document.createElement('video');

//                     const url = URL.createObjectURL(file);

//                     // each type of element has unique events -->
//                     // video does not have "load" event
//                     // but others because videos have to buffer
//                     //https://www.w3schools.com/tags/ref_av_dom.asp
//                     vid.addEventListener("canplaythrough", function(){
//                         console.log("LOADED")
//                         num += 1;
//                         const videoTexture = new resources.VideoResource(vid);
//                         const texture = new Texture(new BaseTexture(videoTexture));
//                         const spr = new Sprite(texture);
//                         engine.renderer.addSprite(spr);

//                         const point = new Point(0,0);
//                         engine.renderer.renderer.plugins.interaction.mapPositionToPoint(point, e.x, e.y)

//                         spr.position = engine.renderer.mainContainer.toLocal(point);
//                         spr.position.x += num * 500;
//                         URL.revokeObjectURL(url);
//                     });

//                     vid.src = url;
//                     //setTimeout(() => console.log(vid),10)
//                 }
//             }
//         })
//     }
// } 


