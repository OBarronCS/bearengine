import { BindCommandCreator, CommandDatabase, comv } from "shared/core/commands"
import { ITEM_LINKER, MIGRATED_ITEMS } from "shared/core/sharedlogic/items";
import { RemoteResources } from "shared/core/sharedlogic/networkschemas";
import { SetInvItemPacket } from "./networking/gamepacketwriters";
import type { PlayerInformation, ServerBearEngine } from "./serverengine";

// What if commands are initiated from a NON player?
// The script is built from that perspective, so the server could just put a dummy player object
// /giveall weapon
// /giveone weapon
// /giveme 

// isPlayer: boolean;
// playerID = -1;

export interface CommandContext {
    engine: ServerBearEngine,
    targetPlayer: PlayerInformation | null
}

const command = BindCommandCreator<CommandContext>();


export const commandDispatcher = new CommandDatabase<CommandContext>();

const database = commandDispatcher;

// Some of these assume they are being called by a player
database.add(
    command("item").args(comv.string_options<keyof typeof MIGRATED_ITEMS>(Object.keys(MIGRATED_ITEMS)))
        .run((context, item_name: keyof typeof MIGRATED_ITEMS) => {

            // Only give the item to the player that ran the command
            
            if(context.targetPlayer === null){
                // aka if the source of the command is the command line, give the item to all players
                context.engine.enqueueGlobalPacket(
                    new SetInvItemPacket(ITEM_LINKER.NameToID(item_name)) 
                    );
            } else {
                //Only give it to the player that made this command
                context.targetPlayer.personalPackets.enqueue(
                    new SetInvItemPacket(ITEM_LINKER.NameToID(item_name)) 
                )
            }
            
        })
    );

database.add(
    command("s").args(comv.string_options<keyof typeof RemoteResources>(Object.keys(RemoteResources)))
        .run((context,arg) => {
            context.engine.beginRound(arg);
        })
    );






