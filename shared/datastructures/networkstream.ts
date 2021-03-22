

// TextEncoder and TextDecoder cannot really write in pre-existing buffers. Not very useful
// Will have to do it manually, char by char,
// All ascii characters
// Fit in 1 byte
//const s = /[\x00-\x7F]/;
//s.test(string): true if is ok

export class BufferStreamReader  {
    
    private littleEndian = false;
    byteOffset: number = 0;

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

    private littleEndian = false;

    // There's one issue: if seeks earlier, it loses the total length
    byteOffset: number = 0;

    private dataview: DataView;

    /** Seeks buffer to beginning. Sets offset to 0. Only data will then be overriden on future calls */
    refresh(){
        this.seek(0);
    }

    size() {
        return this.byteOffset;
    }

    // Returns a copy of the underlying ArrayBuffer, leaving no extra data
    cutoff(): ArrayBuffer {
        return this.dataview.buffer.slice(0,this.byteOffset);
    }

    getBuffer(){
        return this.dataview.buffer;
    }

    constructor(buffer: ArrayBufferLike){
        this.dataview = new DataView(buffer);
    }

    seek(toByte: number){
        if(toByte < 0 || toByte >= this.dataview.byteLength) throw new Error("Moving stream out of bounds");
        this.byteOffset = toByte;
    }

    // Writes the bytes of given buffer to this stream. Copies it.
    // TODO: Assert a given length? 
    setBuffer(buffer: ArrayBuffer): void {
        // Creates a temp Uint8 view of the buffer held by this stream
        // this object allows writing another buffer to it.
        // the underlying buffer of this stream is edited

        // Probably very slow
        const uint8view = new Uint8Array(this.getBuffer());
        uint8view.set(new Uint8Array(buffer), this.byteOffset);
        this.byteOffset += buffer.byteLength;

    }


    setBigInt64(value: bigint){
        this.dataview.setBigInt64(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 8;
    }

    setBigUint64(value: bigint){
        this.dataview.setBigUint64(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 8;
    }

    setFloat32(value: number): void {
        this.dataview.setFloat32(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 4;
    }

    setFloat64(value: number): void {
        this.dataview.setFloat64(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 8;
    }

    setInt8(value: number): void {
        this.dataview.setInt8(this.byteOffset,value);
        this.byteOffset += 1;
    }

    setInt16(value: number): void {
        this.dataview.setInt16(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 2;
    }

    setInt32(value: number): void {
        this.dataview.setInt32(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 4;
    }

    setUint8(value: number): void {
        this.dataview.setUint8(this.byteOffset,value);
        this.byteOffset += 1;
    }

    setUint16(value: number): void {
        this.dataview.setUint16(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 2;
    }

    setUint32(value: number): void {
        this.dataview.setUint32(this.byteOffset,value, this.littleEndian);
        this.byteOffset += 4;
    }

    // TODO:
    // set/write Vec2
    // set/write Array
}
