import { Ellipse } from "shared/shapes/ellipse";
import { Polygon } from "shared/shapes/polygon";
import { Rect } from "shared/shapes/rectangle";
import { Coordinate, coordinateArraytoVec, flattenVecArray, Vec2 } from "shared/shapes/vec2";

export interface CustomMapFormat {
    world:{
        width: number,
        height:number,
        backgroundcolor:string
    },
    // Polygons and Rectangles are turned into this!
    bodies:{
        normals: number[],
        points: number[]
    }[],
    sprites:{
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
export interface TiledMap  {
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
    // console.log("map:" + map)
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
                    const rawPoints: number[] = [];
                    for(let i = 0; i < obj.polygon.length; i++){
                        rawPoints.push(obj.polygon[i].x + obj.x)
                        rawPoints.push(obj.polygon[i].y + obj.y)
                    }
                    
                    const vecArray = coordinateArraytoVec(rawPoints);
                    // Automatically puts everything in clockwise, creates normals.
                    const polygon = Polygon.from(vecArray);

                    const points = flattenVecArray(polygon.points);
                    const normals = flattenVecArray(polygon.normals);

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

                } else if(isEllipse(obj)){
                    // Point is top left, 
                    const ellipse = new Ellipse(new Vec2(obj.x + obj.width / 2, obj.y + obj.height / 2), obj.width / 2, obj.height / 2);
                    const polygon = ellipse.toPolygon();

                    bodies.push({
                        points: flattenVecArray(polygon.points),
                        normals: flattenVecArray(polygon.normals),
                    })

                } else if(isRectangle(obj)){
                    const rect = new Rect(obj.x,obj.y,obj.width, obj.height);
                    
                    const polygon = rect.toPolygon();

                    const points = flattenVecArray(polygon.points);
                    const normals = flattenVecArray(polygon.normals);

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

