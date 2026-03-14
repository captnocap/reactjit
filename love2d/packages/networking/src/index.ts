// @reactjit/networking — Game server hosting in a one-liner
//
// Lua-side: lua/capabilities/game_server.lua (process management, RCON, query protocol)
// React-side: <GameServer> component + hooks for status, players, logs, RCON

export type {
  GameServerType,
  ServerState,
  GameServerConfig,
  Player,
  ServerStatus,
  ServerLog,
  GameServerProps,
  UseGameServerResult,
  UsePlayerListResult,
  UseServerStatusResult,
  UseServerLogsResult,
} from './types';

export { GameServer } from './GameServer';

export {
  useGameServer,
  usePlayerList,
  useServerStatus,
  useServerLogs,
} from './hooks';
