import { Container, Graphics, Text } from "pixi.js";
import { StringIsASCII } from "shared/core/sharedlogic/serialization";
import { Subsystem } from "shared/core/subsystem";
import { NetworkPlatformGame } from "../core-engine/bearengine";

const MAX_MESSAGE_SIZE = 1024;

export class Chatbox extends Subsystem<NetworkPlatformGame> {


    private text_buffer = new TextGapBuffer(MAX_MESSAGE_SIZE);


    container = new Container();

    height = 60;

    enabled = false;

    private box = new Graphics();

    private text_field = this.addTextField();

    addTextField(): Text {
        const t = new Text("");


        this.container.addChild(t);
        return t;
    }

    init(): void {
        this.container.y = this.engine.renderer.getPercentHeight(1) - this.height;
        this.container.visible = false;
        this.container.addChild(this.box);

        // const y = this.engine.renderer.getPercentHeight(1) - this.height;

        this.box.alpha = .56;
        this.box.beginFill(0x9492a1);
        this.box.drawRect(0, 0, this.engine.renderer.getPercentWidth(1), this.height)
        
        console.log(this.box.position)


        this.engine.renderer.addGUI(this.container);

        //window.addEventListener("keydown", e => {console.log(e.code, e.key)})
    }


    update(delta: number): void {
        if(this.enabled){
            const press_info = this.engine.keyboard.pressedKeyInfo();

            

            for(const info of press_info){
                if(info.code === "ArrowLeft"){
                    this.text_buffer.cursorLeft()
                } else if(info.code === "ArrowRight"){
                    this.text_buffer.cursorRight()
                } else if(info.code === "Backspace"){
                    if(this.engine.keyboard.isDown("ControlLeft")){
                        this.text_buffer.deleteWord();
                    } else {
                        this.text_buffer.deleteChar();
                    }
                } else {
                    console.log(info.char, info.code);

                    if(info.char.length === 1 && StringIsASCII(info.char)){
                        this.text_buffer.insertChar(info.char.charCodeAt(0));
                    }
                }
            }

            if(press_info.length !== 0){
            
                this.text_field.text = this.text_buffer.createString();
            }
        }


        if(this.engine.keyboard.wasPressed("KeyT")){
            if(!this.enabled){
                this.enabled = true;
                this.container.visible = true;   
            }
        }

        if(this.engine.keyboard.wasPressed("Escape")){
            if(this.enabled){
                this.enabled = false;
                this.container.visible = false;   
            }
        }
    }
}

const SPACE_CHARCODE = " ".charCodeAt(0);

// Used for editing text
class TextGapBuffer {

    private max_size: number;
    private buffer: Uint8Array;

    private endLeft: number;
    private startRight: number;

    constructor(size: number){
        this.max_size = size;
        this.buffer = new Uint8Array(this.max_size);

        this.endLeft = 0;
        this.startRight = this.max_size;
    }

    cursorLeft(): void {
        if(this.endLeft !== 0){
            this.buffer[--this.startRight] = this.buffer[--this.endLeft];
        }
    }

    cursorRight(): void {
        if(this.startRight !== MAX_MESSAGE_SIZE){
            this.buffer[this.endLeft++] = this.buffer[this.startRight++];
        }
    }

    // Deletes chars until hits a space character. If start at space character, goes throw the word before it
    deleteWord(): void {

        // If start at a space, delete spaces until hit none-space
        while(this.endLeft !== 0 && this.buffer[this.endLeft - 1] === SPACE_CHARCODE){
            this.deleteChar();
        }


        while(this.endLeft !== 0 && this.buffer[this.endLeft - 1] !== SPACE_CHARCODE){
            this.deleteChar();
        }

    }

    deleteChar(): void {
        if(this.endLeft !== 0){
            // Technically, don't need to clear the char in the buffer, but when inspecting the bytes it makes it confusing
            this.buffer[--this.endLeft] = 0;
        }
    }

    insertChar(charCode: number): void {
        this.buffer[this.endLeft++] = charCode;
    }


    createString(): string {
        let str = "";
        for(let i = 0; i < this.endLeft; i++){
            str += String.fromCharCode(this.buffer[i]);
        }

        for(let i = this.startRight; i < MAX_MESSAGE_SIZE; i++){
            str += String.fromCharCode(this.buffer[i]);
        }

        return str;
    }
}
