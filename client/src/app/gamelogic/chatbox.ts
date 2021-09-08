import { Container, Graphics, Text, TextStyle, TextMetrics } from "pixi.js";
import { StringIsPrintableASCII } from "shared/core/sharedlogic/serialization";
import { Subsystem } from "shared/core/subsystem";
import { NetworkPlatformGame } from "../core-engine/bearengine";

const MAX_MESSAGE_SIZE = 128;

export class Chatbox extends Subsystem<NetworkPlatformGame> {


    private text_buffer = new TextGapBuffer(MAX_MESSAGE_SIZE);


    container = new Container();

    height = 60;

    enabled = false;

    private text_style = new TextStyle({
        fontFamily: "Tahoma",
        stroke: "white",
        letterSpacing: 1,
        fontSize: 36
    });

    
    private text_field = new Text("", this.text_style);

    private box = new Graphics();

    private cursor = new Graphics();


    private text_metrics: TextMetrics = TextMetrics.measureText("", this.text_style);

    init(): void {
        
        this.text_field.x = 10;
        this.container.addChild(this.text_field);

        this.container.y = this.engine.renderer.getPercentHeight(1) - this.height;
        this.container.visible = false;
        this.container.addChild(this.box);
        
        this.container.addChild(this.cursor);

        // const y = this.engine.renderer.getPercentHeight(1) - this.height;

        this.box.alpha = .56;
        this.box.beginFill(0x9492a1);
        this.box.drawRect(0, 0, this.engine.renderer.getPercentWidth(1), this.height)
        
        // console.log(this.box.position)


        this.engine.renderer.addGUI(this.container);

        //window.addEventListener("keydown", e => {console.log(e.code, e.key)})
    }


    update(delta: number): void {
        if(this.enabled){
            const press_info = this.engine.keyboard.pressedKeyInfo();

            
            for(const info of press_info){
                switch(info.code){
                    case "ArrowLeft": { 
                        if(this.engine.keyboard.isDown("ControlLeft")){
                            this.text_buffer.wordLeft()
                        } else { 
                            this.text_buffer.cursorLeft(); 
                        }

                        break;
                    }
                    case "ArrowRight": {
                        if(this.engine.keyboard.isDown("ControlLeft")){
                            this.text_buffer.wordRight()
                        } else { 
                            this.text_buffer.cursorRight(); 
                        }

                        break;
                    }
                    case "Backspace": {
                        if(this.engine.keyboard.isDown("ControlLeft")){
                            this.text_buffer.deleteWord();
                        } else {
                            this.text_buffer.deleteChar();
                        }
                        break;
                    }
                    case "Enter": {
                        this.text_buffer.clear();

                        break;
                    }
                    default: {
                        // console.log(info.char, info.code);

                        if(info.char.length === 1 && StringIsPrintableASCII(info.char)){
                            this.text_buffer.insertChar(info.char.charCodeAt(0));
                        }
                    }
                }

            }

            // Update text if something was pressed
            if(press_info.length !== 0){
                this.text_field.text = this.text_buffer.createString();

                this.text_metrics = TextMetrics.measureText(this.text_field.text.substring(0,this.text_buffer["endLeft"]), this.text_style);
            }

            // Draw cursors at correct spot 
            
            this.cursor.clear();

            this.cursor.lineStyle(2);
            
            const x = this.text_metrics.width + this.text_field.x;

            this.cursor.moveTo(x, 4)
            this.cursor.lineTo(x, this.text_metrics.lineHeight - 2)

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

    wordLeft(): void {
         // If start at a space, delete spaces until hit none-space
        while(this.endLeft !== 0 && this.buffer[this.endLeft - 1] === SPACE_CHARCODE){
            this.cursorLeft();
        }


        while(this.endLeft !== 0 && this.buffer[this.endLeft - 1] !== SPACE_CHARCODE){
            this.cursorLeft();
        }
    }

    cursorRight(): void {
        if(this.startRight !== this.max_size){
            this.buffer[this.endLeft++] = this.buffer[this.startRight++];
        }
    }

    wordRight(): void {
        // If right at a space, move through spaces until hit none-space
       while(this.startRight !== this.max_size && this.buffer[this.startRight] === SPACE_CHARCODE){
           this.cursorRight();
       }


       while(this.startRight !== this.max_size && this.buffer[this.startRight] !== SPACE_CHARCODE){
           this.cursorRight();
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

    insertChar(charCode: number): void {
        if(this.endLeft !== this.startRight){
            this.buffer[this.endLeft++] = charCode;
        }
    }

    deleteChar(): void {
        if(this.endLeft !== 0){
            // Technically, don't need to clear the char in the buffer, but when inspecting the bytes it makes it confusing
            this.buffer[--this.endLeft] = 0;
        }
    }

    


    createString(): string {
        let str = "";
        for(let i = 0; i < this.endLeft; i++){
            str += String.fromCharCode(this.buffer[i]);
        }

        for(let i = this.startRight; i < this.max_size; i++){
            str += String.fromCharCode(this.buffer[i]);
        }

        return str;
    }

    clear(){
        this.buffer.fill(0);
        this.endLeft = 0;
        this.startRight = this.max_size;
    }
}
