

import { AssertUnreachable } from "shared/assertstatements";
import { BufferStreamReader, BufferStreamWriter } from "shared/datastructures/networkstream";

/*
The following would allow things to be checked BEFORE connecting to server.
Would catch small errors.
But, still need to validate stuff with live server on connect.

{
    // Could define client constructor stuff using this method
    "shared_class_name": {
        create: () => void = null,
        variables: {
            variable_name: type of variable,
        }
    },
    "other_class": {

    }
}

make it an actual object, {} as const,
    - Allows actual checking
than use typeof to extract the type.
*/
// Used to link client and server entity classes
export interface NetworkedEntityNames {
    "flying_tree": false,
    "auto": false 
}

export interface NetworkedVariableTypes {
    "int8": number,
    "uint8": number,
    "int16": number,
    "uint16": number,
    "int32": number,
    "uint32": number,
    "float": number,
    "double": number,
}


export function SerializeEntityVariable(stream: BufferStreamWriter, value: any, type: keyof NetworkedVariableTypes): void {

    switch(type){
        case "int8": stream.setInt8(value); break;
        case "uint8": stream.setUint8(value); break;
        case "int16": stream.setInt16(value); break;
        case "uint16": stream.setUint16(value); break;
        case "int32": stream.setInt32(value); break;
        case "uint32": stream.setUint32(value); break;
        case "float": stream.setFloat32(value); break;
        case "double": stream.setFloat64(value); break;
        
        default: AssertUnreachable(type);
    }
}

export function DeserializeEntityVariable(stream: BufferStreamReader, type: keyof NetworkedVariableTypes): number {

    switch(type){
        case "int8": return stream.getInt8(); 
        case "uint8": return stream.getUint8(); 
        case "int16": return stream.getInt16(); 
        case "uint16": return stream.getUint16();
        case "int32": return stream.getInt32();
        case "uint32": return stream.getUint32();
        case "float": return stream.getFloat32();
        case "double": return stream.getFloat64();
        
        default: AssertUnreachable(type);
    }
}
