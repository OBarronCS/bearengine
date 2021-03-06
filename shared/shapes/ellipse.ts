import { Shape } from "./shapesinterfaces";
import { Coordinate, Vec2, mix } from "./vec2";
import { Rect } from "./rectangle";
import { Polygon } from "./polygon";
import { dcos, dsin, PI, sin, cos } from "../mathutils";
import type { Graphics } from "pixi.js";


export class Ellipse implements Shape<Ellipse>{
    
    public position: Vec2;
    public rx: number; // radius in x direction
    public ry: number;

    constructor(position: Vec2, rx: number, ry: number){
        this.position = position;
        this.rx = rx;
        this.ry = ry;
    }
    
    clone(): Ellipse {
        return new Ellipse(this.position.clone(), this.rx, this.ry);
    }

    contains(point: Coordinate): boolean {
        const normX = (point.x - this.position.x) / this.rx;
        const normY = (point.y - this.position.y) / this.ry;
        
        return (normX * normX) + (normY * normY) <= 1;
    }

    copyFrom(shape: Ellipse): this {
        this.position = shape.position.clone();
        this.rx = shape.rx;
        this.ry = shape.ry;
        return this;
    }
    
    copyTo(shape: Ellipse): Ellipse {
        return shape.copyFrom(this);
    }

    getAABB(): Rect {
        return new Rect(this.position.x - this.rx,this.position.y - this.ry,this.rx * 2, this.ry * 2);
    }
    
    draw(g: Graphics, color: number = 0x00F0F0): void {
        g.lineStyle(3,color);
        g.drawEllipse(this.position.x, this.position.y, this.rx, this.ry);
    }


    static POLYGON_POINT_COUNT = 35;

    toPolygon(): Polygon {

        const points: Vec2[] = [];
        const normals: Vec2[] = [];
        const STEP = (360 / Ellipse.POLYGON_POINT_COUNT);
        for(let i = 0; i < 360; i += STEP ){
            const x = this.position.x + dcos(i) * this.rx;
            const y = this.position.y + dsin(i) * this.ry;

            // Normal not completely accurate --> its fine for now
            const normal = new Vec2(dcos(i),dsin(i))
            points.push(new Vec2(x,y));
            normals.push(normal);
        }

        return new Polygon(points, normals);
    }
}




