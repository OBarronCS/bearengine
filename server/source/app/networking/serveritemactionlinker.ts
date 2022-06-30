import { ItemActionDef, ItemActionLinker } from "shared/core/sharedlogic/itemactions";
import { NetCallbackTupleType } from "shared/core/sharedlogic/networkschemas";
import { ItemActionAck } from "shared/core/sharedlogic/weapondefinitions";
import { PlayerInformation, ServerBearEngine } from "../serverengine";
import { NewAckItemAction_Fail_Packet, NewAckItemAction_Success_Packet, NewClientDoItemAction_Success_Packet } from "./gamepacketwriters";



// Class decorator, makes it's variables updated over the network. Need client side implementation.
export function link_item_action_attempt<E extends keyof typeof ItemActionDef>(action_name: E) {

    return function(targetConstructor: any){

        SERVER_REGISTERED_ITEMACTIONS.all_classes.push(
            {
                name:action_name,
                attempt:targetConstructor
            }
        );
    
    }
}

export const SERVER_REGISTERED_ITEMACTIONS = {
    all_classes: [] as {name:string, attempt: typeof AttemptAction} [],
    id_to_class_map: new Map<number,typeof AttemptAction>(),

    init(){

        if(this.all_classes.length !== ItemActionLinker.count){
            throw new Error("Missing a item action attempt implementation: " + this.all_classes);
        }

        this.all_classes.sort((a,b) => a.name.localeCompare(b.name));

        for(let i = 0; i < this.all_classes.length; i++){
            this.id_to_class_map.set(i, this.all_classes[i].attempt);
        }
    },
} as const;


export abstract class AttemptAction<E extends keyof typeof ItemActionDef> {
    

    create_server_tick: number;
    
    // state is mutable reference to underlying data/context needed to perform action
    constructor(public readonly game: ServerBearEngine, public player: PlayerInformation, public local_action_id: number)
    {

    }
    
    /**
     * authenticate {
                //do stuff
                //return respond_
            }
            //return respond_
     */
    //@ts-expect-error
    abstract attempt_action(...data: NetCallbackTupleType<typeof ItemActionDef[E]["serverbound"]>): void;

    //@ts-expect-error
    protected respond_success(name: E, ...data: NetCallbackTupleType<typeof ItemActionDef[E]["clientbound"]>): void {

        // send to do_action to all but client
        // send    ack_action to client

        this.game.sendToAllBut(this.player, 
            new NewClientDoItemAction_Success_Packet(
                this.player.connectionID,
                name,
                this.create_server_tick,
                //@ts-expect-error
                data
            )
        );

        this.game.enqueuePacketForClient(this.player.connectionID, 
            new NewAckItemAction_Success_Packet(
                name,
                this.create_server_tick,
                this.local_action_id,
                //@ts-expect-error
                data
            )      
        );
    }
    
    protected respond_fail(name: E, error_code: ItemActionAck): void {
        this.game.enqueuePacketForClient(this.player.connectionID, 
            new NewAckItemAction_Fail_Packet(
                name,
                error_code,
                this.create_server_tick,
                this.local_action_id,
            )      
        );
    }

}

