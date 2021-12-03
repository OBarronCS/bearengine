

// BitString

// Mutable set of bits. Max 32 values
// If want more bits, used Uint8TypedArray
export class BitSet {
    private bits: number = 0;
 
    set(index: number): this {
        this.bits = (this.bits) | (1 << index);  
        return this;
    }

    reset(index: number): this {
        this.bits = this.bits & ~(1 << index);
        return this;
    }

    flip(index: number): this {
        this.bits = this.bits ^ (1 << index);
        return this;
    }

    isSet(index: number): boolean {
        return (this.bits & (1 << index)) !== 0; 
    }

    value(): number {
        return this.bits;
    }

    toString(): string{
        return (this.bits >>> 0).toString(2);
    }
}



