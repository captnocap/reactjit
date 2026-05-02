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

// ── HUD insets ───────────────────────────────────────────────────────
//
// Shell publishes the animated bottom (BottomInputBar reserved height)
// and left (SideMenuInput reserved width) insets each render tick. Pages
// consume `useHudInsets()` to apply matching internal padding so their
// content stays clear of the HUD overlays while their bg paints
// edge-to-edge underneath. This is what lets the bar carry transparent
// bg without flashing during the full→side morph — the page bg shows
// through the bar's vacated area.

interface HudInsets { bottom: number; left: number }

let _insets: HudInsets = { bottom: 0, left: 0 };
const _insetSubs = new Set<() => void>();

export function setHudInsets(bottom: number, left: number): void {
  if (_insets.bottom === bottom && _insets.left === left) return;
  _insets = { bottom, left };
  for (const s of _insetSubs) s();
}

function _subscribeInsets(fn: () => void): () => void {
  _insetSubs.add(fn);
  return () => { _insetSubs.delete(fn); };
}

function _getInsets(): HudInsets { return _insets; }

export function useHudInsets(): HudInsets {
  return React.useSyncExternalStore(_subscribeInsets, _getInsets);
}

// Max fraction of the assistant rail that a HUD-promoted page sub-nav
// (settings nav, etc.) can claim at the top of the column. The shell
// resolves this to a pixel height (= viewport_h * fraction) and passes
// it as a prop to the nav — '%'-string maxHeight on a flex child of
// `S.AppSideMenuInput` doesn't resolve through the framework's layout
// engine and the nav collapses to 0. Pair with flexShrink:0 on the
// InputStrip so the chat absorbs any leftover squeeze, not the input.
export const RAIL_SUBNAV_MAX_FRAC = 0.4;

// ── Settings active section ──────────────────────────────────────────
//
// /settings is now multi-section but stays on a single route path. The
// sub-nav (Profile, Preferences, Providers, …) lives at the HUD level —
// it's rendered as a shell-owned rail beside the assistant rail, not
// inside the iframe — so the active section needs a shell-level store
// the page and the HUD nav can both read/write.

let _settingsSection = 'profile';
const _sectionSubs = new Set<() => void>();

export function setSettingsSection(value: string): void {
  if (_settingsSection === value) return;
  _settingsSection = value;
  for (const s of _sectionSubs) s();
}

export function getSettingsSection(): string { return _settingsSection; }

function _subscribeSection(fn: () => void): () => void {
  _sectionSubs.add(fn);
  return () => { _sectionSubs.delete(fn); };
}

export function useSettingsSection(): [string, (v: string) => void] {
  const value = React.useSyncExternalStore(_subscribeSection, getSettingsSection);
  return [value, setSettingsSection];
}
