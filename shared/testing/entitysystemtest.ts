import { AbstractEntity } from "shared/core/abstractentity";
import { ColliderPart } from "shared/core/entityattribute";
import { EntitySystem } from "shared/core/entitysystem";
import { dimensions } from "shared/shapes/rectangle";
import { Vec2 } from "shared/shapes/vec2";
import { testgroup } from "./testrunner";


// Entity system uses global variables (through Attribute.partID). So these tests alter global variables,
// So only run these independely from game

testgroup("EntitySystem", (g) => {

    //@ts-expect-error
    const system = new EntitySystem({engine: null});

    class TestEntity extends AbstractEntity {
        
        public col = this.addPart(new ColliderPart(dimensions(1,1), new Vec2()))

        update(dt: number): void {}
    }

    g.test("Add Entity", t => {

        const e = new TestEntity();

        system.addEntity(e);
        
        t.assert(system.getEntity(e.entityID) === e);
    })

    g.test("Add Attribute", t => {

        const e = new TestEntity();

        system.addEntity(e);

        t.assert(e.hasAttribute(ColliderPart));
        t.assert(e.getAttribute(ColliderPart) === e.col);
        
    
    });
});

