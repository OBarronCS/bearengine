import { BindCommandCreator, CommandDatabase, comv } from "shared/core/commands"
import { ALL_ITEMS } from "shared/core/sharedlogic/items";
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
    player: PlayerInformation
}

const command = BindCommandCreator<CommandContext>();


export const commandDispatcher = new CommandDatabase<CommandContext>();

const database = commandDispatcher;

// Some of these assume they are being called by a player
database.add(
    command("item").args(comv.string_options<keyof typeof ALL_ITEMS>(Object.keys(ALL_ITEMS)))
        .run((context, item_name: keyof typeof ALL_ITEMS) => {

            context.engine.enqueueGlobalPacket(
                new SetInvItemPacket(ALL_ITEMS[item_name].item_id)
            );
        })
    );






