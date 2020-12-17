
/*

// https://mdn.github.io/dom-examples/pointer-lock/
This API adds a method, requestPointerLock(), to DOM elements

to Document it adds pointerLockElement --> current element being locked
As well as exitPointerLock()
pointerlockchange event --> no extra data
pointerlockerror event --> no extra data

to MouseEvent's it adds
    movementX
    movementY --> basically precalculated screenX - previous.screenX

WHEN LOCKED
    clientX,Y and screenX,Y are kept constant
    movementX and Y will keep moving (no limit to a direction)
    concept of mouse-cursor does not exist

    movementX,Y still worked when no locked
    --> zero when not in browser window
*/

// Presas escape to cancel
export function LockMouse(doc: Document, element: Element){
    element.requestPointerLock();
}