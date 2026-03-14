/**
 * <GameServer> — declarative game server hosting.
 *
 * Wraps the Lua game_server capability. Spawns a game server process,
 * manages config files, RCON connection, and query protocol polling.
 *
 * @example
 * // GoldSrc (CS 1.6)
 * <GameServer type="goldsrc" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />
 *
 * // Source (CS:S, TF2, GMod)
 * <GameServer type="source" config={{ port: 27015, game: "cstrike", map: "de_dust2", maxPlayers: 24 }} />
 *
 * // Source 2 (CS2)
 * <GameServer type="source2" config={{ port: 27015, game: "cs2", map: "de_dust2", maxPlayers: 24 }} />
 *
 * // Minecraft
 * <GameServer type="minecraft" config={{ port: 25565, maxPlayers: 20, difficulty: "normal" }} />
 *
 * // Config from file
 * <GameServer type="source" config="/srv/css/config.json" />
 *
 * // Config from SQLite (persists across restarts)
 * const [config, setConfig] = useLocalStore('my-server', { port: 27015, map: "de_dust2" });
 * <GameServer type="source" config={config} />
 */

import React from 'react';
import { Native } from '@reactjit/core';
import type { GameServerProps } from './types';

export function GameServer({ type: engineType, ...rest }: GameServerProps) {
  return <Native type="GameServer" engineType={engineType} {...rest} />;
}
