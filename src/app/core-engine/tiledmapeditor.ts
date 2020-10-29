


export interface CustomMapFormat {
    world: {
        width: number,
        height:number,
        backgroundColor:string
    },
    // Polygons and Rectangles are turned into this!
    bodies: {
        normals: number[],
        points: number[]
    }[];
}

/*
Import objects in arrays of their type per layer per map

rectangle = [{x,y,width, height}camera];
polygons = [{info}];
ellipse = [{info}];
sprite = []
*/



// TILED MAP EDITOR TYPES



// Anything added to the ObjectGroup
interface MapObject {
    id: number,
    shape: Shape
    name : string,
    type: string,
    x: number,
    y : number,

    // Return zero for Polygons and Polylines!
    width: number, // in pixels
    height: number

    rotation: number // degrees
    

    polygon : {x:number, y:number}[];

    text: string;
}

interface GroupLayer extends Layer{
    layerAt(num: number): Layer,
    readonly layerCount: number;
}

// Object layer API
interface ObjectGroup extends Layer{
    objects : MapObject[],
    objectCount: number,
    objectAt(index : number): MapObject
}

interface Layer {
    name: string,
    visible: boolean;
    isTileLayer: boolean,
    isObjectLayer: boolean,
    isGroupLayer: boolean,
    isImageLayer: boolean,
    offset: {x: number, y:number}
}

interface TiledMap  {
    backgroundColor : string,
    height : number, // tile rows
    width: number, // tile columns
    tileHeight : number,
    tileWidth : number,

    layerCount : number
    layerAt(index: number): Layer
} 

// Object.properties()

// just in the right order
enum Shape {
    Rectangle,
    Polygon,
    Polyline,
    Ellipse,
    Text,
    Point
}

// The tiled map editor is finicky when saving --> have to make sure its actually .custom
const customMapFormat = {
    name: "Custom map format",
    extension: "custom",

    write: function(map: TiledMap, fileName: any) {
        const final_struct = {} as any

        const world_struct = {
            width : map.width * map.tileWidth,
            height : map.height * map.tileHeight,
            backgroundColor : map.backgroundColor
        }

        final_struct.world = world_struct;

        const bodyArray = [];

        // for each layer
        for (let i = 0; i < map.layerCount; ++i) {    
    
            const layer = map.layerAt(i) as ObjectGroup;
            if (layer.isObjectLayer) {
                
                for(let j = 0; j < layer.objectCount; j++){
                    const obj = layer.objectAt(j);
        
                    const body = {} as any
                    if(obj.shape == Shape.Polygon){
                        // Add all polygon points
                        const points = []
                        for(let k = 0; k < obj.polygon.length; k++){
                            points.push(obj.polygon[k].x + obj.x)
                            points.push(obj.polygon[k].y + obj.y)
                        }
                        body.points = points;
                        
                        // Add normals
                        // have to check if clockwise or not!
                        let sum = 0;
                        let j = body.points.length - 2;
                        for(let n = 0; n < body.points.length; n += 2){
                            if(n != 0){
                                j = n - 2
                            }
                            const x1 = body.points[n]
                            const y1 = body.points[n + 1]

                            const x2 = body.points[j]
                            const y2 = body.points[j + 1]

                            sum += (x2 - x1) * (y2 + y1)
                        }

                        // Clockwise as in FLIPPED clockwise
                        // so actually not clockwise
                        let clockwise: boolean;
                        if(sum < 0){
                            //CLOCK WISE
                            clockwise = true
                        } else {
                            clockwise = false
                        }

                        const normals = []
                        let m: number;
                        for(let n = 0; n < body.points.length; n += 2){
                            m = n + 2;
                            if(n == body.points.length - 2){
                                m = 0
                            }

                            const x1 = body.points[n]
                            const y1 = body.points[n + 1]

                            const x2 = body.points[m]
                            const y2 = body.points[m + 1]

                            const dx = x2 - x1;
                            const dy = y2 - y1;

                            const magnitude = Math.sqrt((dx * dx) + (dy * dy));
                            if(clockwise){
                                normals.push(-dy/magnitude, dx/magnitude)
                            } else {
                                normals.push(dy/magnitude, -dx/magnitude)
                            }
                        }
                        body.normals = normals;
                    } else if(obj.shape == Shape.Rectangle){
                        const left = obj.x;
                        const top = obj.y;
                        const right = obj.x + obj.width;
                        const bot = obj.y + obj.height;

                        const points = []
                        points.push(left, top)
                        points.push(right, top)
                        points.push(right, bot)
                        points.push(left, bot)
                        body.points = points;

                        const normals = []
                        normals.push(0,-1)
                        normals.push(1,0)
                        normals.push(0,1)
                        normals.push(-1,0)
                        body.normals = normals;
                    }
                    

                    bodyArray.push(body)
                }
            }
        }

        final_struct.bodies = bodyArray;

        /// @ts-expect-error
        var file = new TextFile(fileName, TextFile.WriteOnly);
        file.write(JSON.stringify(final_struct));
        file.commit();
    },
}
/// @ts-expect-error
tiled.registerMapFormat("custom", customMapFormat)



