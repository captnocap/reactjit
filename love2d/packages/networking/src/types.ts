import type { LoveEvent, Style } from '@reactjit/core';

// ============================================================================
// Game server types
// ============================================================================

/**
 * Valve engine generations:
 *
 * GoldSrc (gen 1): Half-Life, CS 1.6, TFC, Day of Defeat — HLDS binary
 * Source  (gen 2): CS:S, TF2, GMod, L4D2, HL2:DM, DoD:S — srcds binary
 * Source2 (gen 3): CS2, Deadlock — cs2 dedicated binary
 *
 * Each generation has different binaries, config formats, and query quirks.
 * The query protocol (A2S) is shared across all three with minor differences.
 * RCON is shared across Source and Source2; GoldSrc uses a simpler variant.
 */
export type GameServerType =
  | 'goldsrc'    // HL1, CS 1.6, TFC, DoD
  | 'source'     // CS:S, TF2, GMod, L4D2, HL2:DM
  | 'source2'    // CS2, Deadlock
  | 'minecraft';

export type ServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'installing' | 'error';

// ============================================================================
// Config — the single object that defines how a server runs
// ============================================================================

export interface GameServerConfig {
  // Universal
  port?: number;
  maxPlayers?: number;
  name?: string;
  password?: string;
  rconPassword?: string;
  rconPort?: number;
  map?: string;
  mapRotation?: string[];

  // Valve engine (all generations)
  tickrate?: number;
  /**
   * Game identifier within the engine.
   * GoldSrc: "cstrike", "valve", "tfc", "dod"
   * Source:  "cstrike", "tf", "garrysmod", "left4dead2", "hl2mp", "dod"
   * Source2: "cs2", "deadlock"
   */
  game?: string;
  gamemode?: string;

  // Minecraft
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  gameType?: 'survival' | 'creative' | 'adventure' | 'spectator';
  onlineMode?: boolean;
  pvp?: boolean;
  viewDistance?: number;
  spawnProtection?: number;
  maxBuildHeight?: number;
  allowNether?: boolean;
  allowFlight?: boolean;
  /** Path to server JAR (Minecraft only). */
  jar?: string;
  /** Java path override (default: "java"). */
  javaPath?: string;
  /** JVM max heap e.g. "2G", "4096M" (default: "2G"). */
  memory?: string;

  // Valve engine paths
  /** Path to SteamCMD (for auto-install/update). */
  steamcmdPath?: string;
  /** Steam app ID for the dedicated server. */
  appId?: number;
  /** Server binary path (if already installed). */
  serverPath?: string;

  // Passthrough for game-specific extras
  [key: string]: unknown;
}

// ============================================================================
// Player
// ============================================================================

export interface Player {
  id: number;
  name: string;
  score: number;
  duration: number;   // seconds connected
  ping?: number;
}

// ============================================================================
// Server status (returned by query protocol / polling)
// ============================================================================

export interface ServerStatus {
  online: boolean;
  name?: string;
  map?: string;
  players: number;
  maxPlayers: number;
  bots?: number;
  ping?: number;
  version?: string;
  game?: string;
}

// ============================================================================
// Server log entry
// ============================================================================

export interface ServerLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// ============================================================================
// Component props
// ============================================================================

export interface GameServerProps {
  /**
   * Server engine type:
   * - "goldsrc"   — HL1, CS 1.6, TFC, DoD (HLDS)
   * - "source"    — CS:S, TF2, GMod, L4D2 (srcds)
   * - "source2"   — CS2, Deadlock (cs2 dedicated)
   * - "minecraft" — Java Edition (server.jar)
   */
  type: GameServerType;
  /**
   * Server configuration.
   * - string: path to a JSON config file
   * - object: inline config (works with useLocalStore)
   */
  config: string | GameServerConfig;

  // Lifecycle events
  onReady?: (event: LoveEvent) => void;
  onError?: (event: LoveEvent) => void;
  onStopped?: (event: LoveEvent) => void;

  // Player events
  onPlayerJoin?: (event: LoveEvent & { player: string }) => void;
  onPlayerLeave?: (event: LoveEvent & { player: string }) => void;
  onPlayerMessage?: (event: LoveEvent & { player: string; message: string }) => void;

  // Server events
  onMapChange?: (event: LoveEvent & { map: string }) => void;
  onLog?: (event: LoveEvent & { log: string; level: string }) => void;

  key?: string | number;
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseGameServerResult {
  /** Current server lifecycle state. */
  state: ServerState;
  /** Live server status from query protocol. */
  status: ServerStatus | null;
  /** Live player list. */
  players: Player[];
  /** Recent server logs (newest first, capped at 200). */
  logs: ServerLog[];
  /** Send an RCON command. Returns response string. */
  rcon: (command: string) => void;
  /** Start the server. */
  start: () => void;
  /** Stop the server gracefully. */
  stop: () => void;
  /** Download and install the server binary (SteamCMD or Minecraft JAR). */
  install: () => void;
  /** Kick a player by name. */
  kick: (playerName: string, reason?: string) => void;
  /** Ban a player by name. */
  ban: (playerName: string, reason?: string) => void;
  /** Change the current map. */
  changeMap: (map: string) => void;
  /** Send a chat message as the server. */
  say: (message: string) => void;
  /** Available maps from the server's maps/ directory. */
  maps: string[];
}

export interface UsePlayerListResult {
  players: Player[];
  count: number;
  maxPlayers: number;
}

export interface UseServerStatusResult {
  status: ServerStatus | null;
  online: boolean;
  playerCount: number;
  map: string | null;
}

export interface UseServerLogsResult {
  logs: ServerLog[];
  clear: () => void;
}
