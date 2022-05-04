import { CheckedResult, ErrorResult, ValidResult } from "shared/core/commands";

export class BufferStreamReader  {
    
    private littleEndian = false;
    private byteOffset: number = 0;

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

    hasNMoreBytes(n: number): boolean {
        return (this.size - this.byteOffset) >= n; 
    }

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

const UINT8_MAX = (1 << 8) - 1;
const INT8_MIN = -(1 << 7); 
const INT8_MAX = (1 << 7) - 1;

const UINT16_MAX = (1 << 16) - 1;
const INT16_MIN = -(1 << 15); 
const INT16_MAX = (1 << 15) - 1;

const UINT32_MAX = ((-1)>>>0);
const INT32_MIN = -((1 << 31)>>>0); 
const INT32_MAX = (((1 << 31)>>>0) - 1);

const UINT64_MAX: bigint = ((1n) << 64n) - 1n;
const INT64_MIN: bigint= -(1n << 63n); 
const INT64_MAX: bigint = ((1n << 63n) - 1n);


/** 
 *  A wrapper for BufferStreamReader that allows error checking
 *  Pass in optional [min,max] integer values for checking range
 *  Max is inclusive
 * 
 *  Remember to check the fail bit, which is set on reading out of
 *  buffer range and when reading a value outside given range
 */
export class CheckedBufferStreamReader {

    fail = false;

    private stream: BufferStreamReader;

    public readonly size: number;

    constructor(buffer: ArrayBufferLike){
        this.stream = new BufferStreamReader(buffer);
        this.size = this.stream.size;
    }

    // seek(toByte: number){
    //     this.stream.seek(toByte);
    // }

    getBuffer(){
        return this.stream.getBuffer();
    }

    hasMoreData(): boolean {
        return this.stream.hasMoreData();
    }

    hasNMoreBytes(n: number): boolean {
        return this.stream.hasNMoreBytes(n);
    }



    getUint8(min = 0, max = UINT8_MAX): number {
        if(!this.hasNMoreBytes(1)){
            this.fail = true;
            return UINT8_MAX;
        }

        const val = this.stream.getUint8();
        if(val < min || val > max) { 
            this.fail = true;
            return UINT8_MAX 
        }
        return val;
    }

    getInt8(min = INT8_MIN, max = INT8_MAX): number {
        if(!this.hasNMoreBytes(1)){
            this.fail = true;
            return INT8_MAX;
        }

        const val = this.stream.getInt8();
        if(val < min || val > max) { 
            this.fail = true;
            return INT8_MAX 
        }

        return val;
    }


    getUint16(min = 0, max = UINT16_MAX): number {
        if(!this.hasNMoreBytes(2)){
            this.fail = true;
            return UINT16_MAX;
        }

        const val = this.stream.getUint16();
        if(val < min || val > max) {
            this.fail = true;
            return UINT16_MAX;
        } 
            
        return val;
    }

    getInt16(min = INT16_MIN, max = INT16_MAX): number {
        if(!this.hasNMoreBytes(2)){
            this.fail = true;
            return INT16_MAX;
        }

        const val = this.stream.getInt16();
        if(val < min || val > max) {
            this.fail = true;
            return INT16_MAX;
        }
        return val;
    }
    
    getUint32(min = 0, max = UINT32_MAX): number {
        if(!this.hasNMoreBytes(4)){
            this.fail = true;
            return UINT32_MAX;
        }

        const val = this.stream.getUint32();
        if(val < min || val > max) {
            this.fail = true;
            return UINT32_MAX;
        }

        return val;
    }

    getInt32(min = INT32_MIN, max = INT32_MAX): number {
        if(!this.hasNMoreBytes(4)){
            this.fail = true;
            return INT32_MAX;
        }

        const val = this.stream.getInt32();
        if(val < min || val > max) {
            this.fail = true;
            return INT32_MAX;
        }
        return val;
    }

    getBigUint64(min = 0, max = UINT64_MAX): bigint {
        if(!this.hasNMoreBytes(8)){
            this.fail = true;
            return 0xFEFEFEFEFEn;
        }

        const val = this.stream.getBigUint64()
        if(val < min || val > max) {
            this.fail = true;
            return 0xFEFEFEFEFEn;
        }

        return val;
    }
    
    getBigInt64(min = INT64_MIN, max = INT64_MAX): bigint {
        if(!this.hasNMoreBytes(8)){
            this.fail = true;
            return 0xFEFEFEFEFEn;
        }

        const val = this.stream.getBigInt64();

        if(val < min || val > max) {
            this.fail = true;
            return 0xFEFEFEFEFEn;
        }

        return val;
    }
    

    getFloat32(): number {
        if(!this.hasNMoreBytes(4)){
            this.fail = true;
            return 0xABABABAB;
        }

        const val = this.stream.getFloat32();

        return val;
    }

    getFloat64(): number {
        if(!this.hasNMoreBytes(8)){
            this.fail = true;
            return 0xABABABAB;
        }
    
        const val = this.stream.getFloat64();
        return val;
    }

    getBool(): boolean {
        if(!this.hasNMoreBytes(1)){
            this.fail = true;
            return false;
        }

        const val = this.stream.getBool();
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

    /* Allows buffer to be re-used. Does not override data */
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

    clear_to_zero(){
        for(let i = 0; i < this.dataview.byteLength; i++){
            this.dataview.setUint8(i, 0);
        }

        this.refresh();
    }
}







export enum ReadError {
    RANGE_ERROR,
    NO_MEMORY_LEFT
}

type ReadResult<T> = CheckedResult<T, ReadError>;

/** 
 *  A wrapper for BufferStreamReader that allows error checking
 *  Pass in optional [min,max] integer values for checking range
 *  Max is inclusive
 */
class CheckedBufferStreamReader_ResultType {

    private stream: BufferStreamReader;

    public readonly size: number;

    constructor(buffer: ArrayBufferLike){
        this.stream = new BufferStreamReader(buffer);
        this.size = this.stream.size;
    }

    getBuffer(){
        return this.stream.getBuffer();
    }

    // seek(toByte: number){
    //     this.stream.seek(toByte);
    // }
    hasMoreData(): boolean {
        return this.stream.hasMoreData();
    }

    hasNMoreBytes(n: number): boolean {
        return this.stream.hasNMoreBytes(n);
    }



    getUint8(min = 0, max = UINT8_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(1)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getUint8();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }

    getInt8(min = INT8_MIN, max = INT8_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(1)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getInt8();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }


    getUint16(min = 0, max = UINT16_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(2)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getUint16();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }

    getInt16(min = INT16_MIN, max = INT16_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(2)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getInt16();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }
    
    getUint32(min = 0, max = UINT32_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(4)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getUint32();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }

    getInt32(min = INT32_MIN, max = INT32_MAX): ReadResult<number> {
        if(!this.hasNMoreBytes(4)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getInt32();
        if(val < min || val > max) return ErrorResult(ReadError.RANGE_ERROR);
        return ValidResult(val);
    }

    getBigUint64(): ReadResult<bigint> {
        if(!this.hasNMoreBytes(8)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getBigUint64()
        return ValidResult(val);
    }
    
    getBigInt64(): ReadResult<bigint> {
        if(!this.hasNMoreBytes(8)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getBigInt64();
        return ValidResult(val);
    }
    

    getFloat32(): ReadResult<number> {
        if(!this.hasNMoreBytes(4)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getFloat32();
        return ValidResult(val);
    }

    getFloat64(): ReadResult<number> {
        if(!this.hasNMoreBytes(8)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }
    
        const val = this.stream.getFloat64();
        return ValidResult(val);
    }

    getBool(): ReadResult<boolean> {
        if(!this.hasNMoreBytes(1)){
            return ErrorResult(ReadError.NO_MEMORY_LEFT);
        }

        const val = this.stream.getBool();
        return ValidResult(val);
    }

}