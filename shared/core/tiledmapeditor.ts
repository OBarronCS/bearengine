import { SparseSet } from "shared/datastructures/sparseset";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { Ellipse } from "shared/shapes/ellipse";
import { Line } from "shared/shapes/line";
import { Polygon } from "shared/shapes/polygon";
import { Rect } from "shared/shapes/rectangle";
import { Coordinate, coordinateArraytoVec, flattenVecArray, rotatePoint, Vec2 } from "shared/shapes/vec2";

export interface CustomMapFormat {
    world:{
        width: number,
        height:number,
        backgroundcolor:string
    },
    spawn_points: Vec2[],
    item_spawn_points: Vec2[],
    boostzones: {
        rect: Rect,
        dir: Vec2
    }[],
    death_lasers: Line[],
    // Polygons and Rectangles are turned into this!
    bodies:{
        tag:string,
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
    }[],
}

/*
Maybe:
Import objects in arrays of their type per layer per map

rectangle = [{x,y,width, height}];
polygons = [{info}];
ellipse = [{info}];
sprite = []
*/
const IGNORE_ITERATION_STRING = "__IGNORE_ITERATION";
type CustomPropertyNames = "tag" | "boost" | "boost_dir" | "spawn" | "item" | "death_laser" | typeof IGNORE_ITERATION_STRING;

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
    name: CustomPropertyNames,
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

/**
    Two-pass system:
        Map<id, Map<property,value>>;
 */
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
    const boostzones: CustomMapFormat["boostzones"] = [];
    const spawn_points: CustomMapFormat["spawn_points"] = [];
    const item_spawn_points: CustomMapFormat["item_spawn_points"] = [];
    const death_lasers: CustomMapFormat["death_lasers"] = [];


    const property_set = new SparseSet<{ 
        obj: TiledObject,
        properties: Map<CustomPropertyNames, Property>
    }>();

    // First pass
    for (const layer of map.layers as (ObjectLayer|GroupLayer)[]) { 

        switch(layer.type){
            case "objectgroup": {

                for(const obj of layer.objects){
                    
                    if("properties" in obj){
                        const map = new Map<CustomPropertyNames, Property>();

                        for(const prop of obj.properties){
                            map.set(prop.name, prop);
                        }

                        if(map.has("boost_dir")){
                            map.set(IGNORE_ITERATION_STRING, null);
                        }

                        property_set.set(obj.id, { 
                            obj:obj,
                            properties:map,
                        })
                    } else {
                        property_set.set(obj.id, { obj: obj, properties: new Map() });
                    }
                }
                
                break;
            }
            case "group": {
                break;
            }
            default: AssertUnreachable(layer)
        }

    }

    for (const layer of map.layers as (ObjectLayer|GroupLayer)[]) { 
       
        if(layer.type === "objectgroup"){

            for(const obj of layer.objects){

                const object_properties = property_set.get(obj.id).properties;
                if(object_properties.has(IGNORE_ITERATION_STRING)) continue;
        
                if(isPolygon(obj)){
                    // Add all polygon points
                    const rotation_degrees = obj.rotation;

                    const rawPoints: number[] = [];
                    for(let i = 0; i < obj.polygon.length; i++){

                        rawPoints.push(obj.polygon[i].x + obj.x)
                        rawPoints.push(obj.polygon[i].y + obj.y)
                    }

                    const obj_pos = new Vec2(obj.x, obj.y);
                    const rotation_vector = Vec2.from_dangle(rotation_degrees - 90);
                  
                    const vecArray = coordinateArraytoVec(rawPoints);
                    vecArray.forEach(e => rotatePoint(e, obj_pos, rotation_vector))
                   


                    // Automatically puts everything in clockwise, creates normals.
                    const polygon = Polygon.from(vecArray);

                    const points = flattenVecArray(polygon.points);
                    const normals = flattenVecArray(polygon.normals);

                    

                    const tag = object_properties.has("tag") ? object_properties.get("tag").value as string : "";

                    bodies.push({
                        normals:normals,
                        points:points,
                        tag
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

                    const tag = object_properties.has("tag") ? object_properties.get("tag").value as string : "";

                    bodies.push({
                        points: flattenVecArray(polygon.points),
                        normals: flattenVecArray(polygon.normals),
                        tag
                    })

                } else if(isPoint(obj)) {
                    if(property_set.get(obj.id).properties.has("spawn")){
                        spawn_points.push(new Vec2(obj.x, obj.y));
                    } else if(property_set.get(obj.id).properties.has("item")){
                        item_spawn_points.push(new Vec2(obj.x, obj.y));
                    }

                } else if(isRectangle(obj)){

                    const rect = new Rect(obj.x,obj.y,obj.width,obj.height);
                    
                    const polygon = rect.toPolygon();

                    const points = flattenVecArray(polygon.points);
                    const normals = flattenVecArray(polygon.normals);

                    if(object_properties.has("boost")){

                        const polyline_id = object_properties.get("boost").value as number;
                        const polyline = property_set.get(polyline_id).obj as PolylineObject;

                        const dir = Vec2.subtract(polyline.polyline[1], polyline.polyline[0]).normalize();

                        boostzones.push({
                            rect,
                            dir
                        });
                    } else {
                        const tag = object_properties.has("tag") ? object_properties.get("tag").value as string : "";

                        bodies.push({
                            normals:normals,
                            points:points,
                            tag
                        });
                    }
                } else if(isPolyline(obj)){
                    if(property_set.get(obj.id).properties.has("death_laser")){
                        const a = new Vec2(obj.x + obj.polyline[0].x,obj.y + obj.polyline[0].y);
                        const b = new Vec2(obj.x + obj.polyline[1].x,obj.y + obj.polyline[1].y);

                        death_lasers.push(new Line(a,b));
                    }
                }
            }
        }
    }


    return {
        world:worldData,
        boostzones,
        bodies,
        sprites,
        spawn_points,
        item_spawn_points,
        death_lasers
    }
}







