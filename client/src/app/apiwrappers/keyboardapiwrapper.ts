


// Keyboard API allows to LOCK keys so the browser doens't automaccialty use them for events
// like CTRL + W to close tab

// NOT SUPPORTED ON FIREFOX OR SAFARI !!!!
// The official spec is really well written here:
// https://wicg.github.io/keyboard-lock/

// This only actually works in Fullscreen in chrome right now!

// The Escape key is special --> in fullscreen usually click it to immediately leave fullscreen
// But if it is locked you need to hold it to exit fullscreen

export async function LockKeys(codes: KECode[]){
    // @ts-expect-error
    const lock = await navigator.keyboard.lock(codes);
    console.log("Keyboard keys locked: " + codes.toString())
}

// navigator.keyboard.unlock(); to undo all
// all calls to lock clear it before adding the array

// These are accessed from KeyboardEvent.code attribute
// They refer to physical locations on the Keyboard, and not the string that they produce
// so if they happen to be remapped in anyway it still works

// https://www.w3.org/TR/uievents/#code-motivation
// I only added type here that are on my keyboard;

const codes= [
    // Normal keys
    "Backquote",
    "Backslash",
    "Backspace",
    "BracketLeft",
    "BracketRight",
    "Comma",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Equal",
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyD",
    "KeyE",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyM",
    "KeyN",
    "KeyO",
    "KeyP",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyU",
    "KeyV",
    "KeyW",
    "KeyX",
    "KeyY",
    "KeyZ",
    "Minus",
    "Period",
    "Quote",
    "Semicolon",
    "Slash",
    // Some others
    "AltLeft",
    "AltRight",
    "CapsLock",
    "ControlLeft",
    "ControlRight",
    "Enter",
    "MetaLeft", // Windows Key, 
    "ShiftLeft",
    "ShiftRight",
    "Space",
    "Tab",
    // More
    "Delete",
    "End",
    "Home",
    "PageDown",
    "PageUp",
    // ARROW KEYS
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    // I skipped the number pad section  https://www.w3.org/TR/uievents-code/#key-numpad-section
    "Escape",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
    "Fn", // --> bot left for me
    "FnLock",
    "PrintScreen",


    ] as const;


export type KECode = typeof codes[number]







