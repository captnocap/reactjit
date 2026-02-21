import React, { useEffect, useRef, useCallback } from 'react';
import { useBridge, useRendererMode } from '@ilovereact/core';

export interface GameProps {
  /** Name of the Lua game module to load (e.g. "blackhole" → lua/game/blackhole.lua) */
  module: string;
  /** Optional stable key for multiple instances of the same module. */
  instanceKey?: string;
  /** Draw mode: "react" = game only (React handles UI), "original" = game + love.graphics UI */
  mode?: 'react' | 'original';
  /** Declarative config pushed to Lua (modules can handle command="configure"). */
  config?: Record<string, any>;
  /** Event handlers keyed by event name. Fired when the Lua module marks state dirty. */
  on?: Record<string, (data: any) => void>;
  /** Style for the container Box */
  style?: any;
  /** React children render as overlay on top of the game canvas */
  children?: React.ReactNode;
}

/**
 * <Game> — a game viewport that renders a Lua game module into the layout.
 *
 * Follows the Scene3D pattern: creates a 'GameCanvas' host element that Lua's
 * game.lua module recognizes. The game renders to an off-screen Canvas, the
 * painter composites it at layout position, and React children overlay on top.
 *
 * The Lua module owns all game logic and input. React only handles UI overlay.
 *
 * Usage:
 *   <Game module="blackhole" mode="react" on={{ state: (s) => setGameState(s) }}>
 *     <HUD hp={gameState.hp} />
 *   </Game>
 */
export function Game({ module, instanceKey, mode = 'react', config, on, style, children }: GameProps) {
  const bridge = useBridge();
  const rendererMode = useRendererMode();
  const autoInstanceKeyRef = useRef(`game:${module}:${Math.random().toString(36).slice(2, 10)}`);
  const resolvedInstanceKey = instanceKey ?? autoInstanceKeyRef.current;

  // Stable ref for handlers so the subscription effect doesn't recreate
  const onRef = useRef(on);
  onRef.current = on;

  // Subscribe to game events, route to handlers by event name
  useEffect(() => {
    const unsub = bridge.subscribe('game:event', (e: any) => {
      if (!e) return;
      if (e.module && e.module !== module) return;
      if (e.instanceKey && e.instanceKey !== resolvedInstanceKey) return;
      const handler = onRef.current?.[e.name];
      if (handler) handler(e.data);
    });
    return () => unsub();
  }, [bridge, module, resolvedInstanceKey]);

  // Stable command sender for sending UI decisions back to Lua
  const send = useCallback(
    (command: string, args?: any) => {
      bridge.rpc('game:command', { module, instanceKey: resolvedInstanceKey, command, args });
    },
    [bridge, module, resolvedInstanceKey],
  );

  // Declarative config push to Lua.
  useEffect(() => {
    if (!config) return;
    send('configure', { config });
  }, [config, send]);

  if (rendererMode === 'web') {
    return React.createElement(
      'div',
      {
        style: {
          background: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c7086',
          fontSize: 14,
          position: 'relative',
          ...(style as any),
        },
      },
      `Game viewport: ${module} (Love2D only)`,
      children,
    );
  }

  return React.createElement(
    'GameCanvas',
    {
      style: { position: 'relative', ...style },
      module,
      instanceKey: resolvedInstanceKey,
      mode,
    },
    children,
  );
}
