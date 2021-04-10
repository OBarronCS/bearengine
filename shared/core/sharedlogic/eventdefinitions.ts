import { Vec2 } from "shared/shapes/vec2";
import type { MouseButton } from "../../../client/src/app/input/mouse"

// interface CoreEventTypeDefinition {
//     [key: string] : {
//         register_args: {
//             [key: string]: any
//         },
//         callback: (...args: any[]) => any,
//     },
// }

interface BearEvents {
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
}

type BearEventNames = keyof BearEvents;

// KEY! Forces TypeScript to delete the import on compilation
export type { BearEvents }