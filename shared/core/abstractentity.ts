import { EngineKeyboard } from "client/src/app/input/keyboard";
import { Vec2 } from "shared/shapes/vec2";
import { AbstractBearEngine } from "./abstractengine";
import { Part } from "./abstractpart";
import { NULL_ENTITY_INDEX, Scene } from "./scene";

// Signifies that this number is special
export type EntityID = number; 

export abstract class AbstractEntity<Engine extends AbstractBearEngine = AbstractBearEngine> {
    readonly entityID: EntityID = NULL_ENTITY_INDEX;

    readonly position: Vec2 = new Vec2(0,0);
    readonly parts: Part[] = [];

    // Set by scene in "addEntity"
    public scene: Scene;

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

    // Intended for us by abstract classes for behind the scenes work
    postUpdate(): void {}

    addPart<T extends Part>(part: T): T {
        this.parts.push(part);
        part.owner = this;
        return part;
    }

    destroySelf(){
        this.scene.destroyEntity(this);
    }
}






