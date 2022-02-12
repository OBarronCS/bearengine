import type { Vec2 } from "shared/shapes/vec2";
import type { MouseButton } from "../../../client/src/app/input/mouse"
import type { Attribute } from "../entityattribute";

// interface CoreEventTypeDefinition {
//     [key: string] : {
//         register_args: {
//             [key: string]: any
//         },
//         callback: (...args: any[]) => any,
//     },
// }

interface BearEvents {
    "test_test_test": {
        register_args: { other_entity: typeof Attribute };
        callback: (other_entity: typeof Attribute) => void;
    }

    "mousehover": {
        register_args: {};
        callback: (mousePoint: Vec2) => void;
    };
    "tap": {
        register_args: {};
        callback: (mousePoint: Vec2) => void;
    };
    "mousedown":{
        register_args: { button: MouseButton };
        callback: (mousePoint: Vec2) => void;
    }
    /** Scroll when hovered */
    "scroll":{
        register_args: { };
        callback: (scroll: number, mousePoint: Vec2) => void;
    }

    "postupdate":{
        register_args: { };
        callback: (dt: number) => void;
    }

    "preupdate": {
        register_args: { };
        callback: (dt: number) => void;
    }
}

// KEY! Forces TypeScript to delete the import on compilation
export type { BearEvents }