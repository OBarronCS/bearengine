import { Vec2 } from "shared/shapes/vec2";
import { BearGame } from "./abstractengine";

import { Attribute } from "./entityattribute";
import { NULL_ENTITY_INDEX, EntitySystem } from "./entitysystem";

// Signifies that this number is special
export type EntityID = number; 

export abstract class AbstractEntity<TGame extends BearGame<any> = BearGame<{}, any>> {
    readonly entityID: EntityID = NULL_ENTITY_INDEX;

    readonly position: Vec2 = new Vec2(0,0);
    readonly parts: Attribute[] = [];

    // Set by scene in "addEntity"
    public scene: EntitySystem;

    //@ts-expect-error --> Server and client side just make this equal to "engine.this"
    private static GAME_OBJECT: TGame;
    get game(): TGame { return AbstractEntity.GAME_OBJECT}
    get engine(): TGame["engine"] { return this.game.engine; }
    

    get x() { return this.position.x; }
    set x(x: number) { this.position.x = x; }

    get y() { return this.position.y; }
    set y(y: number) { this.position.y = y; }

    abstract update(dt: number): void;

    onAdd(): void {};
    onDestroy(): void {};

    /** Only works before being added to scene */
    protected addPart<T extends Attribute>(part: T): T {
        this.parts.push(part);
        part.owner = this;
        return part;
    }

    hasAttribute<K extends new(...args: any[]) => Attribute>(part: K): boolean {
        return this.scene.hasAttribute(this.entityID, part);
    }

    getAttribute<T extends Attribute, K extends new(...args: any[]) => T>(partConstructor: K): T | null {
        return this.scene.getAttribute(this.entityID, partConstructor);
    }

    destroy(): void {
        this.scene.destroyEntity(this);
    }
}






