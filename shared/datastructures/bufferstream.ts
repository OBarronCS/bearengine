

import { assert } from "shared/misc/assertstatements";
import { Vec2 } from "shared/shapes/vec2";

export class BufferStreamReader  {
    
    private littleEndian = false;
    public byteOffset: number = 0;

    /** Size, in bytes */
    public readonly size: number;

    private dataview: DataView;

    constructor(buffer: ArrayBufferLike){
        this.dataview = new DataView(buffer);

        this.size = buffer.byteLength;
    }

    seek(toByte: number){
        if(toByte < 0 || toByte >= this.size) throw new Error("Moving stream out of bounds");
        this.byteOffset = toByte;
    }

    /// PacketID === 0 is invalid
    /// ASSUMES WE ARE READING GAME DATA 
    hasMoreData(): boolean {
        return this.byteOffset !== this.size;
    }

    getBuffer(){
        return this.dataview.buffer;
    }


    getBigInt64(){
        const val = this.dataview.getBigInt64(this.byteOffset, this.littleEndian)
        this.byteOffset += 8;
        return val;
    }

    getBigUint64(){
        const val = this.dataview.getBigUint64(this.byteOffset, this.littleEndian)
        this.byteOffset += 8;
        return val;
    }

    getFloat32(): number {
        const val = this.dataview.getFloat32(this.byteOffset, this.littleEndian)
        this.byteOffset += 4;
        return val;
    }

    getFloat64(): number {
        const val = this.dataview.getFloat64(this.byteOffset, this.littleEndian)
        this.byteOffset += 8;
        return val;
    }

    getInt8(): number {
        const val = this.dataview.getInt8(this.byteOffset);
        this.byteOffset += 1;
        return val;
    }

    getInt16(): number {
        const val = this.dataview.getInt16(this.byteOffset, this.littleEndian);
        this.byteOffset += 2;
        return val;
    }

    getInt32(): number {
        const val = this.dataview.getInt32(this.byteOffset, this.littleEndian);
        this.byteOffset += 4;
        return val;
    }

    getUint8(): number {
        const val = this.dataview.getUint8(this.byteOffset);
        this.byteOffset += 1;
        return val;
    }

    getBool(): boolean {
        const val = this.dataview.getUint8(this.byteOffset);
        this.byteOffset += 1;
        return val > 0;
    }

    getUint16(): number {
        const val = this.dataview.getUint16(this.byteOffset, this.littleEndian);
        this.byteOffset += 2;
        return val;
    }

    getUint32(): number {
        const val = this.dataview.getUint32(this.byteOffset, this.littleEndian);
        this.byteOffset += 4;
        return val;
    }
}


export class BufferStreamWriter {

    // The max position we have written to. Is same as byteOffset if never call seek() 
    private maxOffset = 0
    // The byte we write to on next call
    private byteOffset = 0;

    private littleEndian = false;
    private dataview: DataView;

    constructor(buffer: ArrayBufferLike){
        this.dataview = new DataView(buffer);
    }

    size() { return this.maxOffset; }
    getBuffer() { return this.dataview.buffer; }

    /** Returns a copy of the underlying ArrayBuffer, cutting off at the max offset written to */
    cutoff(): ArrayBuffer {
        return this.dataview.buffer.slice(0,this.maxOffset);
    }

    refresh(){
        this.byteOffset = 0;
        this.maxOffset = 0;
    }

    seek(toByte: number){
        this.byteOffset = toByte;

        if(this.byteOffset > this.maxOffset){
            this.maxOffset = this.byteOffset;
        }
    }

    seekRelative(shift: number){
        this.byteOffset += shift;

        if(this.byteOffset > this.maxOffset){
            this.maxOffset = this.byteOffset;
        }
    }
    
    /**  Writes the bytes of given buffer to this stream. Copies it.*/
    setBuffer(buffer: ArrayBuffer): void {
        // Unfortunately, DataView's don't allow settings buffers, so need another ArrayBufferView to do that
        
        const uint8view = new Uint8Array(this.getBuffer());
        uint8view.set(new Uint8Array(buffer), this.byteOffset);
        this.seekRelative(buffer.byteLength);
    }


    setBigInt64(value: bigint){
        this.dataview.setBigInt64(this.byteOffset, value, this.littleEndian)
        this.seekRelative(8);
    }

    setBigUint64(value: bigint){
        this.dataview.setBigUint64(this.byteOffset, value, this.littleEndian)
        this.seekRelative(8);
    }

    setFloat32(value: number): void {
        this.dataview.setFloat32(this.byteOffset, value, this.littleEndian)
        this.seekRelative(4);
    }

    setFloat64(value: number): void {
        this.dataview.setFloat64(this.byteOffset, value, this.littleEndian)
        this.seekRelative(8);
    }

    setInt8(value: number): void {
        this.dataview.setInt8(this.byteOffset,value);
        this.seekRelative(1);
    }

    setInt16(value: number): void {
        this.dataview.setInt16(this.byteOffset, value, this.littleEndian);
        this.seekRelative(2);
    }

    setInt32(value: number): void {
        this.dataview.setInt32(this.byteOffset, value, this.littleEndian);
        this.seekRelative(4);
    }

    setUint8(value: number): void {
        this.dataview.setUint8(this.byteOffset,value);
        this.seekRelative(1);
    }

    setBool(bool: boolean): void {
        this.dataview.setUint8(this.byteOffset,bool ? 1 : 0);
        this.seekRelative(1);
    }

    setUint16(value: number): void {
        this.dataview.setUint16(this.byteOffset, value, this.littleEndian);
        this.seekRelative(2);
    }

    setUint32(value: number): void {
        this.dataview.setUint32(this.byteOffset,value, this.littleEndian);
        this.seekRelative(4);
    }

    
    // setVec2(vec: Vec2): void {

    // }

    // set/write Array
}



// TextEncoder and TextDecoder cannot really write in pre-existing buffers. Not very useful
// Will do it manually, char by char,
// All ascii characters
// Fit in 1 byte

//s.test(string): true if is ok


const ASCII_REGEX = /^[\x00-\x7F]*$/;

export function StreamWriteString(stream: BufferStreamWriter, str: string): void {
    
    const length = str.length;

    assert(length <= ((1 << 16) - 1), "String must be less than 65536 characters --> " + str);
    assert(ASCII_REGEX.test(str), "Character must be ascii encodable --> " + str);
    

    stream.setUint16(length);

    for(const char of str){
        stream.setUint8(char.charCodeAt(0));
    }
}

export function StreamReadString(stream: BufferStreamReader): string {
    let str = "";

    const length = stream.getUint16();

    for(let i = 0; i < length; i++){
        str += String.fromCharCode(stream.getUint8());
    }
    
    return str;
}
