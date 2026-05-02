// Shell-level UI state for cart/app.
//
// Currently exposes one bit of state — `inputFocal`. Activities call
// `setInputFocal(true)` when they want to take the persistent
// <InputStrip> into focal mode (state C in the shell state machine —
// see cart/app/app.md "Animation principles → Input-strip side-dock
// morph"). They call `setInputFocal(false)` to release it (back to
// state B, the docked default).
//
// Focal state PERSISTS across route changes — only the activity that
// took focus knows when it's done with it. The shell never auto-resets
// it on navigation; the route just re-derives the resolved state and
// the morph machinery transitions only when the resolved state
// actually changes.
//
// Plain module-level store + subscribe pattern, mirroring the theme
// variant store in runtime/theme.tsx.

import * as React from 'react';

let _focal = false;
const _subs = new Set<() => void>();

function _notify(): void {
  for (const s of _subs) s();
}

function _subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}

function _getFocal(): boolean {
  return _focal;
}

/** Imperative setter — activities call this to take/release the input. */
export function setInputFocal(value: boolean): void {
  if (_focal === value) return;
  _focal = value;
  _notify();
}

/** Read-only accessor for non-React callers. */
export function getInputFocal(): boolean {
  return _focal;
}

/** Hook — returns `[focal, setFocal]` shaped like useState. */
export function useInputFocal(): [boolean, (v: boolean) => void] {
  const value = React.useSyncExternalStore(_subscribe, _getFocal);
  return [value, setInputFocal];
}
