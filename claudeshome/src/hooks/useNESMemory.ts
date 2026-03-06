/**
 * useNESMemory — reads NES system RAM via libretro RPCs.
 *
 * Discovers the active Libretro instance, then polls specific memory
 * addresses to extract game state (lives, HP, stage, etc).
 *
 * Mega Man 2 memory map (NES system RAM):
 *   $00A0 - Lives remaining
 *   $06C0 - Mega Man HP (0-28)
 *   $06C1 - Boss HP (0-28)
 *   $00A9 - Current weapon/stage select
 *   $0031 - Game state (0=title, 3=stage select, 5=playing, etc)
 *   $00FE - Screen scroll X
 *   $002A - Current stage number
 */
import { useState, useRef, useCallback } from 'react';
import { useLoveRPC, useLuaInterval } from '@reactjit/core';

export interface MegaMan2State {
  lives: number;
  hp: number;
  bossHp: number;
  weapon: number;
  stage: number;
  gameState: number;
  scrollX: number;
  raw: number[];  // full 256-byte dump from $0000
}

const EMPTY: MegaMan2State = {
  lives: 0, hp: 0, bossHp: 0, weapon: 0, stage: 0,
  gameState: 0, scrollX: 0, raw: [],
};

const STAGE_NAMES: Record<number, string> = {
  0: 'Metal Man',
  1: 'Air Man',
  2: 'Bubble Man',
  3: 'Quick Man',
  4: 'Crash Man',
  5: 'Flash Man',
  6: 'Heat Man',
  7: 'Wood Man',
};

const WEAPON_NAMES: Record<number, string> = {
  0: 'Mega Buster',
  1: 'Metal Blade',
  2: 'Air Shooter',
  3: 'Bubble Lead',
  4: 'Quick Boomerang',
  5: 'Crash Bomber',
  6: 'Time Stopper',
  7: 'Atomic Fire',
  8: 'Leaf Shield',
};

export function useNESMemory() {
  const listRpc = useLoveRPC('libretro:list');
  const memRpc = useLoveRPC('libretro:memory');
  const listRef = useRef(listRpc);
  const memRef = useRef(memRpc);
  listRef.current = listRpc;
  memRef.current = memRpc;

  const [nodeId, setNodeId] = useState<string | null>(null);
  const [state, setState] = useState<MegaMan2State>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discover Libretro instance every 2.3s (staggered)
  useLuaInterval(2300, async () => {
    try {
      const result = await listRef.current({}) as any;
      if (result?.instances?.length > 0) {
        setNodeId(result.instances[0].nodeId);
        setConnected(true);
        setError(null);
      } else {
        setNodeId(null);
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  });

  // Read memory every 503ms when connected (staggered prime)
  useLuaInterval(503, async () => {
    if (!nodeId) return;
    try {
      // Read $0000-$06FF (1792 bytes covers all important addresses)
      const result = await memRef.current({
        nodeId,
        memType: 2, // SYSTEM_RAM
        offset: 0,
        length: 1792,
      }) as any;

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.bytes) {
        const b = result.bytes as number[];
        setState({
          lives:     b[0xA0 + 1] ?? 0,  // +1 because Lua arrays are 1-indexed
          hp:        b[0x6C0 + 1] ?? 0,
          bossHp:    b[0x6C1 + 1] ?? 0,
          weapon:    b[0xA9 + 1] ?? 0,
          stage:     b[0x2A + 1] ?? 0,
          gameState: b[0x31 + 1] ?? 0,
          scrollX:   b[0xFE + 1] ?? 0,
          raw:       b.slice(0, 256),
        });
        setError(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  });

  return {
    state,
    connected,
    error,
    nodeId,
    stageName: STAGE_NAMES[state.stage] ?? `Stage ${state.stage}`,
    weaponName: WEAPON_NAMES[state.weapon] ?? `Weapon ${state.weapon}`,
  };
}
