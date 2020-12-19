import { Vec2, mix, Coordinate } from "../shapes/vec2";
import type { Graphics } from "pixi.js";

export interface Path {
    getPointAt(t: number): Coordinate
    // getTangentAt(t: number): Vec2
}

class PointList {

    public points: Vec2[];

    constructor(pts: Vec2[]) {
        this.points = pts;
    }

    draw(g: Graphics, color = 0xFF0FF0){
        g.lineStyle(3,color)
        for (let i = 0; i < this.points.length - 1; ++i) {
		    const p1 = this.points[i];
            const p2 = this.points[i + 1];
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
        }
    }

    lastPoint(){
        return this.points[this.points.length - 1]
    }

    firstPoint(){
        return this.points[0]
    }
    

    // //  ALLOWS USE OF for ... of loop
    // [Symbol.iterator](){
    //     let index = 0;
    //     const iterator = {
    //         next: () => {
    //             if(index < this.length){
    //                 const p = this.points[index]
    //                 index++
    //                 return { value: p, done: false };
    //             } 
                
    //             return { value: null, done: true };
                
    //         } // called when loop is ended prematurely
    //         //return: () => {
    //        //     console.log('cleaning up...');
    //         //    return { value: undefined, done: true };
    //        // //}
    //     };
    //     return iterator;
    // }
}

export class LinearPath extends PointList implements Path{
    
    // so that I move linearly with distance
    
    public lengthList = [0];
    public totalDistance = 0;
    public distance = 0;
    
    
    constructor(pts: Vec2[]) {
        super(pts);

        for (let i = 0; i < this.points.length - 1; i++) {
            const spot = pts[i];
            const nextSpot = pts[i + 1]

            const distance = spot.distance(nextSpot);

            this.lengthList.push(this.distance + distance);
            this.distance += distance;
        }
    }


    getPointAt(t: number): Vec2 {
        if(t >= 1){
            return this.lastPoint()
        }

        const distanceSoFar = t * this.distance;
        
        let index1 = 0;
        while(this.lengthList[index1 + 1] < distanceSoFar){
            index1 += 1;
        }

        const dis1 = this.lengthList[index1];
        const dis2 = this.lengthList[index1 + 1];

        const percentage = (distanceSoFar - dis1)/(dis2 - dis1)

        // percentage is between these two points
        const point1 = this.points[index1]
        const point2 = this.points[index1 + 1]
        
        const x = point1.x + ((point2.x - point1.x) * percentage);
        const y = point1.y + ((point2.y - point1.y) * percentage);

        return new Vec2(x,y);
    }


}

// TODO --> more accurate tesselation
//https://docs.godotengine.org/en/stable/tutorials/math/beziers_and_curves.html
        // and tesselation
export class BezierCurve extends PointList implements Path {

    private segmentCount = 50;

    constructor(pts: Vec2[]) {
        super(pts);
    }

    getPointAt(t: number): Vec2 {
		return this.getInterpolatedPoint(this.points, t);
	}
	
	getInterpolatedPoint(_points: Vec2[], t: number): Vec2{		
        const len = _points.length;
        console.log(len)
		if(len == 1){
			return _points[0];
        }
        
		const arr: Vec2[] = []
		for (let i = 0; i < len - 1; ++i) {
		    const p1 = _points[i];
			const p2 = _points[i + 1]
			
			const lerped_point = mix(p1, p2, t);
			arr.push(lerped_point);
		}
		
		return this.getInterpolatedPoint(arr, t);
    }

    // Returns a list of points with the baked points
    bakePoints(): PointList {
        const segmentCount = 100;
        const points: Vec2[] = [];
        
    	for(let i = 0; i <= segmentCount; ++i){
    		const t = i / segmentCount;
    		points.push(this.getPointAt(t));
        }
        return new PointList(points);
    }

    draw(g: Graphics, color = 0xFF0F000){
        this.bakePoints().draw(g, color);
    }
}

export class HermiteCurve extends PointList implements Path {
    
    segmentCount = 50; 
    constructor(pts: Vec2[]) {
        super(pts);
    }

	CubicHermite(A: number, B: number, C: number, D: number, t: number): number{
        const a = -A/2.0 + (3.0*B)/2.0 - (3.0*C)/2.0 + D/2.0;
        const b = A - (5.0*B)/2.0 + 2.0*C - D / 2.0;
        const c = -A/2.0 + C/2.0;
        const d = B;

        return a*t*t*t + b*t*t + c*t + d;
	}
	
	GetIndexClamped(index: number): Vec2{
	    if (index < 0)
	        return this.points[0];
	    else if (index >= this.points.length)
	        return this.lastPoint();
	    else
	        return this.points[index];
	}

	// returns vec2 of the point of the thing1!
	// t = [0,1];
	getPointAt(percent: number): Vec2 {
		const tx = (this.points.length - 1) * percent;
        const index = Math.floor(tx);
            
		//percentage of t from this point and next point!
		const t = tx - Math.floor(tx);
 
        const A =this.GetIndexClamped(index - 1);
        const B =this.GetIndexClamped(index + 0);
        const C =this.GetIndexClamped(index + 1);
        const D =this.GetIndexClamped(index + 2);
			
		const _x = this.CubicHermite(A.x, B.x, C.x, D.x, t);
        const _y = this.CubicHermite(A.y, B.y, C.y, D.y, t);
 
		return new Vec2(_x,_y);
    }

    bakePoints(): PointList {
        const segmentCount = 100;
        const points: Vec2[] = [];
        
    	for(let i = 0; i <= segmentCount; ++i){
    		const t = i / segmentCount;
    		points.push(this.getPointAt(t));
        }
        return new PointList(points);
    }

    draw(g: Graphics, color = 0xFF0F000){
        this.bakePoints().draw(g, color);
    }
}





