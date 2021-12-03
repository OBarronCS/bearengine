import { BindCommandCreator, CommandDatabase, comv } from "shared/core/commands"
import { ITEM_LINKER, MIGRATED_ITEMS, RandomItemID } from "shared/core/sharedlogic/items";
import { LevelRef } from "shared/core/sharedlogic/assetlinker";
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
            
            if(!context.engine.roundIsActive()) {
                console.log("Cannot give items when round is not active");
                return;
            }

            // Only give the item to the player that ran the command
            
            if(context.targetPlayer === null){
                // aka if the source of the command is the command line, give the item to all players
                console.log("CANNOT GIVE ALL PLAYERS ITEM")
                return;
            } else {
                //Only give it to the player that made this command
                const p = context.targetPlayer;

                context.engine.givePlayerItem(p,context.engine.createItemFromPrefab(ITEM_LINKER.NameToID(item_name)));
            }
            
        })
    );

database.add(
    command("s").args(comv.string_options<keyof typeof LevelRef>(Object.keys(LevelRef)))
        .run((context,arg) => {
            context.engine.beginRound(arg);
        })
    );






