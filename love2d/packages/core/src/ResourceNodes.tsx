/**
 * ResourceNodes — Non-visual tree nodes that replace useEffect-based hooks.
 *
 * These components render invisible capability nodes whose lifecycle is
 * managed by the reconciler (subscribe/unsubscribe) and Lua capabilities
 * (create/update/tick/destroy). Zero useEffect anywhere in the chain.
 *
 * Timer already exists in capabilities.tsx — use that instead.
 *
 * Usage:
 *   <BridgeEvent event="viewport" onEvent={(e) => setDims(e)} />
 *   <Hotkey combo="ctrl+s" onKeyDown={() => save()} />
 *   <WindowConfig width={800} height={600} />
 */

import React from 'react';

// ── BridgeEvent ──────────────────────────────────────────────────────

export interface BridgeEventProps {
  /** Bridge event type to subscribe to (e.g. 'viewport', 'keydown') */
  event: string;
  /** Called when the event fires */
  onEvent?: (payload: any) => void;
}

/**
 * Subscribe to a bridge event as a tree node.
 * The reconciler manages subscribe/unsubscribe — no useEffect.
 * Replaces useLoveEvent.
 *
 * @example
 * <BridgeEvent event="viewport" onEvent={(e) => setDims(e)} />
 * <BridgeEvent event="entity:spawned" onEvent={handleSpawn} />
 */
export function BridgeEvent(props: BridgeEventProps): React.ReactElement {
  return React.createElement('BridgeEvent', {
    __subscribe: props.event,
    onEvent: props.onEvent,
  });
}

// ── Hotkey ────────────────────────────────────────────────────────────

export interface HotkeyProps {
  /** Key combo string (e.g. 'ctrl+s', 'ctrl+shift+z', 'escape') */
  combo: string;
  /** Whether the hotkey is active (default: true) */
  enabled?: boolean;
  /** Called when the combo is pressed */
  onKeyDown?: (event: any) => void;
}

/**
 * Global keyboard shortcut as a tree node.
 * The reconciler subscribes to 'keydown' and filters by combo.
 * Replaces useHotkey.
 *
 * @example
 * <Hotkey combo="ctrl+s" onKeyDown={() => save()} />
 * <Hotkey combo="escape" enabled={isOpen} onKeyDown={() => close()} />
 */
export function Hotkey(props: HotkeyProps): React.ReactElement {
  return React.createElement('Hotkey', {
    __subscribeKey: props.enabled === false ? null : 'keydown',
    combo: props.combo,
    onKeyDown: props.onKeyDown,
  });
}

// ── WindowConfig ─────────────────────────────────────────────────────

export interface WindowConfigProps {
  /** Window width in pixels */
  width?: number;
  /** Window height in pixels */
  height?: number;
  /** Window x position */
  x?: number;
  /** Window y position */
  y?: number;
  /** Pin window on top */
  alwaysOnTop?: boolean;
  /** Revert to previous values on unmount (default: false) */
  revert?: boolean;
  /** Animate transitions (default: false) */
  animate?: boolean;
  /** Animation duration in ms (default: 300) */
  duration?: number;
  /** Target window ID (0 = main, default: 0) */
  windowId?: number;
}

/**
 * Declarative window configuration as a tree node.
 * Props are diffed by the reconciler, applied by Lua capability.
 * Reverts on unmount if `revert` is true.
 * Replaces useWindowSize, useWindowPosition, useWindowAlwaysOnTop.
 *
 * @example
 * <WindowConfig width={800} height={600} />
 * <WindowConfig x={100} y={200} alwaysOnTop revert />
 */
export function WindowConfig(props: WindowConfigProps): React.ReactElement {
  return React.createElement('WindowConfig', {
    width: props.width,
    height: props.height,
    x: props.x,
    y: props.y,
    alwaysOnTop: props.alwaysOnTop ?? false,
    revert: props.revert ?? false,
    animate: props.animate ?? false,
    duration: props.duration ?? 300,
    windowId: props.windowId ?? 0,
  });
}
