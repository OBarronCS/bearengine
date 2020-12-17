

// TextEncoder and TextDecoder cannot really write in pre-existing buffers. Not very useful
// Will have to do it manually, char by char,
// All ascii characters
// Fit in 1 byte
//const s = /[\x00-\x7F]/;
//s.test(string): true if is ok



export class BufferWriterStream extends DataView {

    private littleEndian = false;
    byteOffset: number = 0;

    constructor(buffer: ArrayBufferLike){
        super(buffer);
    }

    // getFloat32(byteOffset: number, littleEndian?: boolean): number {
    //     return super.getFloat32(byteOffset, littleEndian);
    // }
    // getFloat64(byteOffset: number, littleEndian?: boolean): number {
    //     return super.getFloat64(byteOffset, littleEndian);
    // }
    // getInt8(byteOffset: number): number;
    // getInt16(byteOffset: number, littleEndian?: boolean): number;
    // getInt32(byteOffset: number, littleEndian?: boolean): number;
    // getUint8(byteOffset: number): number;
    // getUint16(byteOffset: number, littleEndian?: boolean): number;
    // getUint32(byteOffset: number, littleEndian?: boolean): number;

    setFloat32(value: number): void {
        super.setFloat32(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 4;
    }

    setFloat64(value: number): void {
        super.setFloat64(this.byteOffset, value, this.littleEndian)
        this.byteOffset += 8;
    }

    setInt8(value: number): void {
        super.setInt8(this.byteOffset,value);
        this.byteOffset += 1;
    }

    setInt16(value: number): void {
        super.setInt16(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 2;
    }

    setInt32(value: number): void {
        super.setInt32(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 4;
    }

    setUint8(value: number): void {
        super.setUint8(this.byteOffset,value);
        this.byteOffset += 1;
    }

    setUint16(value: number): void {
        super.setUint16(this.byteOffset, value, this.littleEndian);
        this.byteOffset += 2;
    }

    setUint32(value: number): void {
        super.setUint32(this.byteOffset,value, this.littleEndian);
        this.byteOffset += 4;
    }

    // TODO:
    // set/write Vec2
    // set/write Array
}
