import { Vec2 } from "shared/shapes/vec2";

import { AbstractBearEngine } from "./abstractengine";
import { Attribute } from "./entityattribute";
import { NULL_ENTITY_INDEX, EntitySystem } from "./entitysystem";

// Signifies that this number is special
export type EntityID = number; 

export abstract class AbstractEntity<Engine extends AbstractBearEngine = AbstractBearEngine> {
    readonly entityID: EntityID = NULL_ENTITY_INDEX;

    readonly position: Vec2 = new Vec2(0,0);
    readonly parts: Attribute[] = [];

    // Set by scene in "addEntity"
    public scene: EntitySystem;

    //@ts-expect-error --> Server and client side just make this equal to "engine.this"
    private static ENGINE_OBJECT: Engine;
    get engine(): Engine { return AbstractEntity.ENGINE_OBJECT; }

    get x() { return this.position.x; }
    set x(x: number) { this.position.x = x; }

    get y() { return this.position.y; }
    set y(y: number) { this.position.y = y; }

    abstract update(dt: number): void;

    onAdd(): void {};
    onDestroy(): void {};

    addPart<T extends Attribute>(part: T): T {
        this.parts.push(part);
        part.owner = this;
        return part;
    }

    hasAttribute<K extends new(...args: any[]) => Attribute>(part: K){
        return this.scene.hasAttribute(this.entityID, part);
    }

    getAttribute<T extends Attribute, K extends new(...args: any[]) => T>(partConstructor: K): T | null {
        return this.scene.getAttribute(this.entityID, partConstructor);
    }

    destroy(){
        this.scene.destroyEntity(this);
    }
}






