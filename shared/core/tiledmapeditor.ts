import { Coordinate } from "shared/shapes/vec2";

export interface CustomMapFormat {
    world: {
        width: number,
        height:number,
        backgroundcolor:string
    },
    // Polygons and Rectangles are turned into this!
    bodies: {
        normals: number[],
        points: number[]
    }[],
    sprites: {
        name: string // name of collection in tiled. Not instance name for now
        x: number,
        y: number,
        file_path: string,
        width: number,
        height: number,
    }[]
}

/*
Maybe:
Import objects in arrays of their type per layer per map

rectangle = [{x,y,width, height}];
polygons = [{info}];
ellipse = [{info}];
sprite = []
*/


// Infinite maps have additional properties
interface TiledMap  {
    backgroundcolor?: string, //#RRGGBB, if alpha is not 255 its #AARRGGBB
    height: number, // tile rows,
    width: number, // tile columns,
    tileheight: number, // width of each tile,
    tilewidth: number, // height of each tile,
    infinite: boolean, // has no real impact on anything
    version: number;
    tilesets: Tileset[],
    layers: Layer[]  
} 

// has lots more, but if just images this is good enough
interface Tileset {
    firstgid: number, // connected to gid of image objects
    name: string // name of 'collection'
    tiles: {
        // has a local id, have to test how
        image: string // // filepath, relative from current folder
                    // if in same folder as map file, its just file name
    }[] // will have only one in most cases
}

interface Property {
    name: string,
    type: "string"|"int"|"float"|"bool"|"color"|"color"|"file"
    value: unknown;
}

// some of these properties might be different for infinite maps
interface Layer {
    name: string,
    offsetx: number,
    offsety: number,
    type: "group"|"objectgroup"|"tilelayer"|"imagelayer"
    properties: Property[]
}

interface GroupLayer extends Layer {
    type:"group",
    layers: Layer[]
}

interface ObjectLayer extends Layer {
    type: "objectgroup",
    objects : TiledObject[],
}

interface TiledObject {
    id: number;
    name: string;
    type: string; // blank string unless otherwise stated
    rotation: number;
    x: number;
    y: number;

    properties?: Property[]
}

// #region Object types
interface ImageObject extends TiledObject {
    gid: number; // connects it to a tilesets firstgid
    height: number;
    width: number;
    // IMPORTANT: x and y is BOTTOM left, of image, NOT TOP LEFT
}

function isImageObject(object: any): object is ImageObject {
    return object.gid !== undefined
}

interface PolylineObject extends TiledObject {
    polyline: Coordinate[]
}

function isPolyline(object: any): object is PolylineObject {
    return object.polyline !== undefined
}

interface PolygonObject extends TiledObject{
    polygon: Coordinate[] // first and last point do not repeat
}

function isPolygon(object: any): object is PolygonObject {
    return object.polygon !== undefined
}

interface EllipseObject extends TiledObject {
    ellipse: true;
    height: number;
    width: number;
}

function isEllipse(object: any): object is EllipseObject {
    return object.ellipse !== undefined
}

interface PointObject extends TiledObject {
    point: true;
}

function isPoint(object: any): object is PointObject {
    return object.point !== undefined
}

interface RectangleObject extends TiledObject {
    height: number;
    width: number;
}

function isRectangle(object: any): object is RectangleObject {
    return !isPoint(object) && !isEllipse(object) && !isImageObject(object) && !isPolygon(object) && !isPolyline(object);
}
//#endregion



export function ParseTiledMapData(map: TiledMap): CustomMapFormat {
    console.log(map)
    const worldData: CustomMapFormat["world"] = {
        width: map.width * map.tilewidth,
        height: map.height * map.tileheight,
        // ideally, this would be a nullish ?? coalescing operator, but doesn't work if target is ESNext because webpacket parser cannot read it
        backgroundcolor: map.backgroundcolor || "#FFFFFF"
    }

    const bodies: CustomMapFormat["bodies"] = [];
    const sprites: CustomMapFormat["sprites"] = [];

    for (const layer of map.layers as (ObjectLayer|GroupLayer)[]) { 
       
        if(layer.type === "objectgroup"){

            for(const obj of layer.objects){
        
                if(isPolygon(obj)){
                    // Add all polygon points
                    const points = []
                    for(let i = 0; i < obj.polygon.length; i++){
                        points.push(obj.polygon[i].x + obj.x)
                        points.push(obj.polygon[i].y + obj.y)
                    }
                    
                    
                    // Add normals
                    // have to check if clockwise or not!
                    let sum = 0;
                    let j = points.length - 2;
                    for(let n = 0; n < points.length; n += 2){
                        if(n != 0){
                            j = n - 2
                        }
                        const x1 = points[n]
                        const y1 = points[n + 1]

                        const x2 = points[j]
                        const y2 = points[j + 1]

                        sum += (x2 - x1) * (y2 + y1)
                    }

                    // Clockwise as in FLIPPED clockwise
                    // so actually not clockwise
                    const clockwise: boolean = sum < 0 ? true : false;

                    const normals = []
                    let m: number;
                    for(let n = 0; n < points.length; n += 2){
                        m = n + 2;
                        if(n == points.length - 2){
                            m = 0
                        }

                        const x1 = points[n];
                        const y1 = points[n + 1];

                        const x2 = points[m];
                        const y2 = points[m + 1];

                        const dx = x2 - x1;
                        const dy = y2 - y1;

                        const magnitude = Math.sqrt((dx * dx) + (dy * dy));
                        if(clockwise){
                            normals.push(-dy/magnitude, dx/magnitude)
                        } else {
                            normals.push(dy/magnitude, -dx/magnitude)
                        }
                    }

                    bodies.push({
                        normals:normals,
                        points:points
                    });

                } else if(isImageObject(obj)){
                    
                    let tileset: Tileset;

                    for(const potentialTileset of map.tilesets){
                        if(potentialTileset.firstgid === obj.gid){
                            tileset = potentialTileset;
                            break;
                        }
                    }

                    const sprite: CustomMapFormat["sprites"][number] = {
                        file_path:tileset.tiles[0].image,
                        name:tileset.name,
                        height:obj.height,
                        width:obj.width,
                        x:obj.x,
                        y:obj.y - obj.height
                    }

                    sprites.push(sprite);

                } else if(isRectangle(obj)){
                    const left = obj.x;
                    const top = obj.y;
                    const right = obj.x + obj.width;
                    const bot = obj.y + obj.height;

                    const points = []
                    points.push(left, top)
                    points.push(right, top)
                    points.push(right, bot)
                    points.push(left, bot)

                    const normals = []
                    normals.push(0,-1)
                    normals.push(1,0)
                    normals.push(0,1)
                    normals.push(-1,0)
                    
                    bodies.push({
                        normals:normals,
                        points:points
                    });
                }
            }
        }
    }


    return {
        world:worldData,
        bodies:bodies,
        sprites:sprites
    }
}

// const customMapFormat = {
//     name: "Custom map format",
//     extension: "custom",

//     write: function(map: TiledMap, fileName: any) {
//         const final_struct = {} as any

//         const world_struct = {
//             width : map.width * map.tileWidth,
//             height : map.height * map.tileHeight,
//             backgroundColor : map.backgroundColor
//         }

//         final_struct.world = world_struct;

//         const bodyArray = [];

//         // for each layer
//         for (let i = 0; i < map.layerCount; ++i) {    
    
//             const layer = map.layerAt(i) as ObjectGroup;
//             if (layer.isObjectLayer) {
                
//                 for(let j = 0; j < layer.objectCount; j++){
//                     const obj = layer.objectAt(j);
        
//                     const body = {} as any
//                     if(obj.shape == Shape.Polygon){
//                         // Add all polygon points
//                         const points = []
//                         for(let k = 0; k < obj.polygon.length; k++){
//                             points.push(obj.polygon[k].x + obj.x)
//                             points.push(obj.polygon[k].y + obj.y)
//                         }
//                         body.points = points;
                        
//                         // Add normals
//                         // have to check if clockwise or not!
//                         let sum = 0;
//                         let j = body.points.length - 2;
//                         for(let n = 0; n < body.points.length; n += 2){
//                             if(n != 0){
//                                 j = n - 2
//                             }
//                             const x1 = body.points[n]
//                             const y1 = body.points[n + 1]

//                             const x2 = body.points[j]
//                             const y2 = body.points[j + 1]

//                             sum += (x2 - x1) * (y2 + y1)
//                         }

//                         // Clockwise as in FLIPPED clockwise
//                         // so actually not clockwise
//                         let clockwise: boolean;
//                         if(sum < 0){
//                             //CLOCK WISE
//                             clockwise = true
//                         } else {
//                             clockwise = false
//                         }

//                         const normals = []
//                         let m: number;
//                         for(let n = 0; n < body.points.length; n += 2){
//                             m = n + 2;
//                             if(n == body.points.length - 2){
//                                 m = 0
//                             }

//                             const x1 = body.points[n]
//                             const y1 = body.points[n + 1]

//                             const x2 = body.points[m]
//                             const y2 = body.points[m + 1]

//                             const dx = x2 - x1;
//                             const dy = y2 - y1;

//                             const magnitude = Math.sqrt((dx * dx) + (dy * dy));
//                             if(clockwise){
//                                 normals.push(-dy/magnitude, dx/magnitude)
//                             } else {
//                                 normals.push(dy/magnitude, -dx/magnitude)
//                             }
//                         }
//                         body.normals = normals;
//                     } else if(obj.shape == Shape.Rectangle){
//                         const left = obj.x;
//                         const top = obj.y;
//                         const right = obj.x + obj.width;
//                         const bot = obj.y + obj.height;

//                         const points = []
//                         points.push(left, top)
//                         points.push(right, top)
//                         points.push(right, bot)
//                         points.push(left, bot)
//                         body.points = points;

//                         const normals = []
//                         normals.push(0,-1)
//                         normals.push(1,0)
//                         normals.push(0,1)
//                         normals.push(-1,0)
//                         body.normals = normals;
//                     }
                    

//                     bodyArray.push(body)
//                 }
//             }
//         }

//         final_struct.bodies = bodyArray;
//     },
// }



