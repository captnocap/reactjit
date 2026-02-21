/**
 * eventDispatcher.ts
 *
 * The glue between bridge events and React component handlers.
 *
 * Subscribes to Lua events (click, pointerEnter, keydown, etc.) and
 * dispatches them to the appropriate handlers in handlerRegistry.
 *
 * For mouse events: dispatches to the specific targetId
 * For keyboard events: routes to focused node when targetId present, broadcasts globally otherwise
 * For focus events: dispatches to the specific targetId
 */

import type { LoveEvent } from '../../shared/src/types';
import { handlerRegistry } from './hostConfig';
import { reportError } from './errorReporter';
import { debugLog } from './debugLog';

/** Any object with a subscribe method (NativeBridge, CanvasBridge, etc.) */
interface Subscribable {
  subscribe(type: string, fn: (payload: any) => void): () => void;
}

type ListLike<T> = T[] | Record<string, T> | null | undefined;

function normalizeList<T>(value: ListLike<T>): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const keys = Object.keys(value);
  if (keys.length === 0) return [];

  const sortedKeys = keys
    .slice()
    .sort((a, b) => {
      const ai = Number(a);
      const bi = Number(b);
      const aIsInt = Number.isInteger(ai) && String(ai) === a;
      const bIsInt = Number.isInteger(bi) && String(bi) === b;
      if (aIsInt && bIsInt) return ai - bi;
      if (aIsInt) return -1;
      if (bIsInt) return 1;
      return a.localeCompare(b);
    });

  const record = value as Record<string, T>;
  return sortedKeys.map((key) => record[key]);
}

/**
 * Initialize event dispatching for a bridge.
 * Call this once when the bridge is created.
 * Accepts any object with a subscribe() method (NativeBridge, CanvasBridge, etc.)
 */
export function initEventDispatching(bridge: Subscribable): void {
  // ── Mouse events (bubbling) ──────────────────────────────

  bridge.subscribe('click', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onClick');
  });

  bridge.subscribe('release', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onRelease');
  });

  // ── Mouse events (non-bubbling) ──────────────────────────

  bridge.subscribe('pointerEnter', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onPointerEnter');
  });

  bridge.subscribe('pointerLeave', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onPointerLeave');
  });

  // ── Keyboard events (focus-routed when targetId present, broadcast otherwise) ──

  bridge.subscribe('keydown', (event: LoveEvent) => {
    if (event.targetId) {
      dispatchWithBubbling(event, 'onKeyDown');
    } else {
      broadcastToAll(event, 'onKeyDown');
    }
  });

  bridge.subscribe('keyup', (event: LoveEvent) => {
    if (event.targetId) {
      dispatchWithBubbling(event, 'onKeyUp');
    } else {
      broadcastToAll(event, 'onKeyUp');
    }
  });

  bridge.subscribe('textinput', (event: LoveEvent) => {
    if (event.targetId) {
      dispatchWithBubbling(event, 'onTextInput');
    } else {
      broadcastToAll(event, 'onTextInput');
    }
  });

  // ── Wheel events (bubbling) ─────────────────────────────

  bridge.subscribe('wheel', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onWheel');
  });

  // ── Scroll events (target-only) ─────────────────────────

  bridge.subscribe('scroll', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onScroll');
  });

  bridge.subscribe('layout', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onLayout');
  });

  // ── Touch events (bubbling for start/end, broadcast for move) ──

  bridge.subscribe('touchstart', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onTouchStart');
  });

  bridge.subscribe('touchend', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onTouchEnd');
  });

  bridge.subscribe('touchmove', (event: LoveEvent) => {
    broadcastToAll(event, 'onTouchMove');
  });

  // ── Gamepad events (global broadcast) ───────────────────

  bridge.subscribe('gamepadpressed', (event: LoveEvent) => {
    broadcastToAll(event, 'onGamepadPress');
  });

  bridge.subscribe('gamepadreleased', (event: LoveEvent) => {
    broadcastToAll(event, 'onGamepadRelease');
  });

  bridge.subscribe('gamepadaxis', (event: LoveEvent) => {
    broadcastToAll(event, 'onGamepadAxis');
  });

  // ── MIDI events (global broadcast) ───────────────────────

  bridge.subscribe('midi:note', (event: LoveEvent) => {
    broadcastToAll(event, 'onMidiNote');
  });

  bridge.subscribe('midi:cc', (event: LoveEvent) => {
    broadcastToAll(event, 'onMidiCC');
  });

  // ── Drag events (bubbling) ──────────────────────────────

  bridge.subscribe('dragstart', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onDragStart');
  });

  bridge.subscribe('drag', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onDrag');
  });

  bridge.subscribe('dragend', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onDragEnd');
  });

  // ── File drop events (bubbling) ─────────────────────────

  bridge.subscribe('filedrop', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onFileDrop');
  });

  bridge.subscribe('directorydrop', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onDirectoryDrop');
  });

  // ── File drag hover events (bubbling) ─────────────────

  bridge.subscribe('filedragenter', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onFileDragEnter');
  });

  bridge.subscribe('filedragleave', (event: LoveEvent) => {
    dispatchWithBubbling(event, 'onFileDragLeave');
  });

  // ── Focus events (target-only) ─────────────────────────

  bridge.subscribe('focus', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onFocus');
  });

  bridge.subscribe('blur', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onBlur');
  });

  // ── TextEditor events (Lua-owned, target-only) ────────

  bridge.subscribe('texteditor:focus', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextEditorFocus');
  });

  bridge.subscribe('texteditor:blur', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextEditorBlur');
  });

  bridge.subscribe('texteditor:submit', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextEditorSubmit');
  });

  bridge.subscribe('texteditor:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextEditorChange');
  });

  // ── TextInput events (Lua-owned, target-only) ─────────

  bridge.subscribe('textinput:focus', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextInputFocus');
  });

  bridge.subscribe('textinput:blur', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextInputBlur');
  });

  bridge.subscribe('textinput:submit', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTextInputSubmit');
  });

  // ── Video events (target-only) ────────────────────────

  bridge.subscribe('video:ready', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onReady');
  });

  bridge.subscribe('video:error', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onError');
  });

  bridge.subscribe('onReady', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onReady');
  });

  bridge.subscribe('onTimeUpdate', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onTimeUpdate');
  });

  bridge.subscribe('onPlay', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onPlay');
  });

  bridge.subscribe('onPause', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onPause');
  });

  bridge.subscribe('onEnded', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onEnded');
  });

  // ── ContextMenu events (Lua-owned, target-only) ──────

  bridge.subscribe('contextmenu:select', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onContextMenuSelect');
  });

  bridge.subscribe('contextmenu:open', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onContextMenuOpen');
  });

  bridge.subscribe('contextmenu:close', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onContextMenuClose');
  });

  // ── Slider events (Lua-owned, target-only) ─────────

  bridge.subscribe('slider:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onValueChange');
  });

  bridge.subscribe('slider:start', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingStart');
  });

  bridge.subscribe('slider:end', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingEnd');
  });

  // ── Fader events (Lua-owned, target-only) ─────────

  bridge.subscribe('fader:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onChange');
  });

  bridge.subscribe('fader:start', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingStart');
  });

  bridge.subscribe('fader:end', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingEnd');
  });

  // ── Knob events (Lua-owned, target-only) ─────────

  bridge.subscribe('knob:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onChange');
  });

  bridge.subscribe('knob:start', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingStart');
  });

  bridge.subscribe('knob:end', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onSlidingEnd');
  });

  // ── Switch events (Lua-owned, target-only) ─────────

  bridge.subscribe('switch:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onValueChange');
  });

  // ── Checkbox events (Lua-owned, target-only) ─────────

  bridge.subscribe('checkbox:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onValueChange');
  });

  // ── Radio events (Lua-owned, target-only) ─────────

  bridge.subscribe('radio:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onValueChange');
  });

  // ── Select events (Lua-owned, target-only) ─────────

  bridge.subscribe('select:change', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onValueChange');
  });

  // ── Capability events (Audio, Timer, etc.) ───────────
  //
  // Single subscription handles ALL capabilities. The Lua side specifies
  // which handler to invoke via event.handler (e.g. "onProgress", "onTick").
  // No per-capability wiring needed — new capabilities just work.

  bridge.subscribe('capability', (event: LoveEvent) => {
    if (event.handler) {
      dispatchToTargetOnly(event, event.handler);
    }
  });

  // ── Map events (Lua-owned, target-only) ─────────

  bridge.subscribe('map:viewchange', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onViewChange');
  });

  bridge.subscribe('map:click', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onClick');
  });

  bridge.subscribe('map:featureclick', (event: LoveEvent) => {
    dispatchToTargetOnly(event, 'onFeatureClick');
  });
}

/**
 * Dispatch an event with bubbling support.
 * Walks the bubblePath from target to root, calling handlers at each level
 * until stopPropagation is called.
 */
function dispatchWithBubbling(event: LoveEvent, handlerName: string): void {
  if (!event.targetId) return;
  const bubblePath = normalizeList<number>((event as any).bubblePath);
  debugLog.log('dispatch', `bubble ${handlerName} target=${event.targetId} path=[${bubblePath.join(',')}]`);

  let stopped = false;
  const enrichedEvent: LoveEvent = {
    ...event,
    stopPropagation: () => { stopped = true; },
    currentTarget: event.targetId,
    bubblePath,
  };

  if (bubblePath.length > 0) {
    for (const nodeId of bubblePath) {
      if (stopped) break;

      enrichedEvent.currentTarget = nodeId;

      const handlers = handlerRegistry.get(nodeId);
      if (!handlers) continue;

      const handler = handlers[handlerName];
      if (typeof handler === 'function') {
        try {
          handler(enrichedEvent);
        } catch (e) {
          reportError(e, `${handlerName} for node ${nodeId}`);
        }
      }
    }
  } else {
    const handlers = handlerRegistry.get(event.targetId);
    if (!handlers) return;
    const handler = handlers[handlerName];
    if (typeof handler === 'function') {
      handler(enrichedEvent);
    }
  }
}

/**
 * Dispatch an event to only the target node (no bubbling).
 * Used for pointer enter/leave events.
 */
function dispatchToTargetOnly(event: LoveEvent, handlerName: string): void {
  if (!event.targetId) return;
  debugLog.log('dispatch', `direct ${handlerName} target=${event.targetId}`);
  const handlers = handlerRegistry.get(event.targetId);
  if (!handlers) return;
  const handler = handlers[handlerName];
  if (typeof handler === 'function') {
    handler(event);
  }
}

/**
 * Broadcast an event to ALL nodes that have the specified handler.
 * Used for keyboard events which are global (no focus system yet).
 */
function broadcastToAll(event: LoveEvent, handlerName: string): void {
  for (const [_nodeId, handlers] of handlerRegistry) {
    const handler = handlers[handlerName];
    if (typeof handler === 'function') {
      handler(event);
    }
  }
}
