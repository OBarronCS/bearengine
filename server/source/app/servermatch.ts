import { readFileSync } from "fs";
import path from "path";
import { LevelRef, LevelRefLinker } from "shared/core/sharedlogic/assetlinker";
import { RandomItemID } from "shared/core/sharedlogic/items";
import { MatchDurationType, MatchGamemode } from "shared/core/sharedlogic/sharedenums";
import { TiledMap, ParseTiledMapData } from "shared/core/tiledmapeditor";
import { choose, most_frequent_choose } from "shared/datastructures/arrayutils";
import { AssertUnreachable } from "shared/misc/assertstatements";
import { random, random_int } from "shared/misc/random";
import { Rect } from "shared/shapes/rectangle";
import { Vec2 } from "shared/shapes/vec2";
import { EndMatchPacket, EndRoundPacket } from "./networking/gamepacketwriters";
import { ConnectionID } from "./networking/serversocket";
import { ServerPlayerEntity } from "./playerlogic";
import { PlayerInformation, ServerBearEngine } from "./serverengine";
import { BoostZone_S } from "./weapons/boostzones";
import { InstantDeathLaser_S, ItemEntity } from "./weapons/serveritems";

export class WorldInfo {
    constructor(
        public readonly level_id: number,
        // The bounds of the map defined in the Tiled Map
        public readonly map_bounds: Rect,
        // Where items get destroyed
        public readonly level_bbox: Rect,
        public readonly player_death_bbox: Rect,
        public readonly item_spawn_points: readonly Vec2[],

    ){}
}

/** Initializes terrain and world data */
export function load_tiled_map(game: ServerBearEngine,  map: keyof typeof LevelRef) {
        const level_path = LevelRef[map];
        const level_id = LevelRefLinker.NameToID(map);

        const tiled_data: TiledMap = JSON.parse(readFileSync(path.join(__dirname, "../../../client/dist/assets/" + level_path), "utf-8"));
        const level_data = ParseTiledMapData(tiled_data);


        // Create terrain and world size
        const worldInfo = level_data.world;
        const width = worldInfo.width;
        const height = worldInfo.height;

        const bodies = level_data.bodies;
        game.terrain.setupGrid(width, height);
        
        bodies.forEach(body => {
            game.terrain.addTerrain(body.points, body.normals, body.tag)
        });

        level_data.boostzones.forEach(b => {
            game.entities.addEntity(new BoostZone_S(b.rect, b.dir));
        });

        level_data.death_lasers.forEach(line => {
            game.createRemoteEntity(new InstantDeathLaser_S(line))
        })


        game.world_info = new WorldInfo(
            level_id,
            new Rect(0,0,width,height),
            Rect.from_corners(-400, -1000, width + 400, height + 600),
            Rect.from_corners(-350, -1000, width + 350, height + 600),
            [...level_data.item_spawn_points]
        );

        return level_data;
}


interface NextWorldManager {
    next_level(): keyof typeof LevelRef
}

interface MatchDurationManager {
    type: MatchDurationType,
    value: number;
}

/**
 * new Match(FreeForAll)
 *  EndCondition -> First to N
 *                  100 rounds.
 * 
 */
export class Match {

    played_rounds = 0;

    match_over = false;
    update_match = true;

    constructor(
        public game: ServerBearEngine,
        // Used to check if in lobby, network what mode we are in
        public readonly gamemode: MatchGamemode,
        public round_ctor: new(game: ServerBearEngine, world_id: keyof typeof LevelRef) => Round, 
        public round_count: number, 
        public next_world_manager: NextWorldManager,
        public duration_manager: MatchDurationManager
        )
    {
        
    }

    round_winners = {
        winners:[] as PlayerInformation[],
        winner_map:new Map<ConnectionID, number>()
    }

    current_round: Round;

    start(){
        this.current_round = new this.round_ctor(this.game, this.next_world_manager.next_level());
    }

    update(){
        this.current_round.round_timer++;

        this.current_round.update();

        if(this.current_round.round_over){
            this.current_round.end();

            this.round_winners.winners.push(this.current_round.round_winner);
            
            this.played_rounds++;
            

            switch(this.duration_manager.type){
                case MatchDurationType.N_ROUNDS: {
                    if(this.played_rounds >= this.duration_manager.value){

                        const overall_winner = most_frequent_choose(this.round_winners.winners.map(p => p.connectionID));

                        this.game.broadcast_packet_safe(
                            new EndMatchPacket(this.gamemode, overall_winner)
                        );

                        this.match_over = true;
                        return;
                    }
                    break;
                }
                case MatchDurationType.FIRST_TO_N: {

                    break;
                }
                case MatchDurationType.TIME: {

                    break;
                }
                default: AssertUnreachable(this.duration_manager.type)
            }


            const next_level = this.next_world_manager.next_level();

            this.current_round = new this.round_ctor(this.game, next_level);
            this.game.start_of_new_round(next_level);

            this.current_round.start();
        }
    }
}


abstract class Round {

    readonly dead_players: PlayerInformation[] = [];

    round_timer = 0;

    round_over: boolean = false;
    round_winner: PlayerInformation = null;

    constructor(public game: ServerBearEngine, public world_id: keyof typeof LevelRef)
    {

    }

    abstract start(): void;
    abstract update(): void;
    abstract end(): void;

    end_round(winner: PlayerInformation){
        this.round_over = true;
        this.round_winner = winner;
    }
}


const ROUND_OVER_REST_TIMER_TICKS = 60 * 3;

export class LobbyRound extends Round {
    start(): void {}

    update(): void {}

    end(): void {}
}

export class FreeForAllRound extends Round {

    private round_over_timer: number = 0;
    private round_over_wait_flag = false;

    start(): void {}

    update(): void {
        if(!this.round_over_wait_flag){
            // Spawn items
            if(random() > .98){
                const random_itemprefab_id = RandomItemID();
    
                const item_instance = this.game.createItemFromPrefab(random_itemprefab_id);
    
                const item = new ItemEntity(item_instance);
    
                
                if(this.game.world_info.item_spawn_points.length > 0){
                    const location = choose(this.game.world_info.item_spawn_points);
                    item.pos.set(location);
                } else {
                    item.pos.x = random_int(100, this.game.world_info.map_bounds.width - 100);
                }
    
                if(random() > .99){
                    item.art_path = "mystery_box.png";
                }
                
    
                this.game.createRemoteEntity(item);
            }
    
            // Check for dead players
            for(const player_entity of this.game.entities.view(ServerPlayerEntity)){
                if(player_entity.get_health() <= 0 || !this.game.world_info.player_death_bbox.contains(player_entity.position)){
                    this.game.kill_player(player_entity);
                }
            }

            // Round over condition
            const all_players = this.game.entities.view(ServerPlayerEntity);
            // console.log(all_players.length)
            if(all_players.length <= 1){
                // One person left, the winner
                if(all_players.length === 1){
                    this.dead_players.push(all_players[0].client);
                }
    
                
                this.game.broadcast_packet_safe(
                    new EndRoundPacket([...this.dead_players.map(p => p.connectionID)].reverse(), ROUND_OVER_REST_TIMER_TICKS)
                );
                this.round_over_wait_flag = true;
            }

        } else {
            this.round_over_timer++;
            if(this.round_over_timer >= ROUND_OVER_REST_TIMER_TICKS){
                this.end_round(this.dead_players[this.dead_players.length - 1]);
            }
        }
    }

    end(): void {
        
    }

}


// export class GunGameRound extends Round {

// }


