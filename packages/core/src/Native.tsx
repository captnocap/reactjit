import React from 'react';
import type { NativeProps } from './types';

/**
 * Handler-aware shallow comparator for React.memo.
 *
 * Event handlers (on*) never cross the bridge — they stay in JS and
 * are dispatched by the reconciler's handlerRegistry.  A new arrow
 * function identity on `onTick` doesn't mean the Lua capability needs
 * an update, so we skip handler comparison entirely.  Everything else
 * is compared by reference (same as React.memo's default).
 */
function nativePropsEqual(prev: NativeProps, next: NativeProps): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of nextKeys) {
    if (key === 'children') {
      // Children are opaque React elements — let React handle them.
      // If children changed, React will reconcile the subtree regardless.
      continue;
    }
    // Skip handler identity comparison — they never cross the bridge.
    if (key.startsWith('on') && key.length > 2 && key[2] === key[2].toUpperCase()) {
      // Just check presence/absence, not identity.
      if ((key in prev) !== (key in next)) return false;
      continue;
    }
    if ((prev as any)[key] !== (next as any)[key]) return false;
  }
  return true;
}

export const Native = React.memo(function Native({ type, ...props }: NativeProps) {
  return React.createElement(type, props);
}, nativePropsEqual);
