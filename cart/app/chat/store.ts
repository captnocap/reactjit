// Module-level supervisor-thread store.
//
// Mirrors `cart/app/shell.tsx`'s focal store pattern — useSyncExternalStore
// over a tiny pub/sub. v1 holds a single thread in memory; persistence
// via useCRUD is the follow-up commit (see app.md → Persistent assistant
// chat → "Datashape decision: ONE thread or MANY?").
//
// Why module-level state instead of React context? Identity continuity
// across the side ↔ full morph: the chat panel re-mounts when its slot
// changes (AppSideMenuInput vs the activity content area), and the
// thread state must survive that swap unchanged. A module-level store
// is the simplest version of this that doesn't fight the renderer.

import * as React from 'react';
import type { AssistantTurn, ChatSurface } from './types';

// Empty by default — turns flow in via `appendTurn` from the
// AssistantChatProvider as the user submits and Claude replies. The
// fixture transcript (./fixtures.ts) stays in the tree as a visual
// reference but is no longer the seed.
let _turns: AssistantTurn[] = [];
const _subs = new Set<() => void>();

function _notify(): void {
  for (const s of _subs) s();
}
function _subscribe(fn: () => void): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}
function _getTurns(): AssistantTurn[] {
  return _turns;
}

export function getTurns(): AssistantTurn[] {
  return _turns;
}

export function appendTurn(turn: AssistantTurn): void {
  _turns = [..._turns, turn];
  _notify();
}

export function replaceTurns(next: AssistantTurn[]): void {
  _turns = next;
  _notify();
}

/** Mutates the body of an existing turn (matched by id). No-op if the id
 *  isn't found — the asker may race the store on streaming updates and
 *  we'd rather drop a late update than throw. */
export function updateTurnBody(id: string, body: string): void {
  const i = _turns.findIndex((t) => t.id === id);
  if (i < 0) return;
  const cur = _turns[i];
  _turns = [
    ..._turns.slice(0, i),
    { ...cur, body } as AssistantTurn,
    ..._turns.slice(i + 1),
  ];
  _notify();
}

/** Attach (or clear) an embedded surface card on an assistant turn.
 *  Provider calls this after parseIntent on the finalized reply when
 *  the model emitted chat-loom tags. Pass `null` to drop a surface. */
export function updateTurnSurface(id: string, surface: ChatSurface | null): void {
  const i = _turns.findIndex((t) => t.id === id);
  if (i < 0) return;
  const cur = _turns[i];
  if (cur.author !== 'asst') return;
  const next: any = { ...cur };
  if (surface == null) delete next.surface;
  else next.surface = surface;
  _turns = [..._turns.slice(0, i), next, ..._turns.slice(i + 1)];
  _notify();
}

/** Hook — returns the live turn list. Subscribers re-render on mutate. */
export function useChatTurns(): AssistantTurn[] {
  return React.useSyncExternalStore(_subscribe, _getTurns, _getTurns);
}

// ── Asker (provider → input strip seam) ──────────────────────────────
//
// `<AssistantChatProvider>` mounts inside ShellBody, owns the
// useAssistantChat hook, and publishes its orchestrated `ask` here.
// `InputStrip.submit()` calls `askAssistant(text)` to fire a chat turn
// without depending on hook context (the strip's slot changes during
// the morph; we can't host the hook there).

let _asker: ((text: string) => Promise<string>) | null = null;

export function setAsker(fn: ((text: string) => Promise<string>) | null): void {
  _asker = fn;
}

export function askAssistant(text: string): Promise<string> {
  if (!_asker) {
    return Promise.reject(new Error('chat: AssistantChatProvider not mounted'));
  }
  return _asker(text);
}

// Monotonic id helper for fresh turns — small + sufficient for an
// in-memory transcript. CRUD-backed ids will replace this when chat
// persistence lands.
let _idCounter = 0;
export function nextTurnId(prefix: string): string {
  _idCounter = (_idCounter + 1) | 0;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

// ── Chat status (provider → header subline) ───────────────────────────
//
// Provider publishes the live generation hook's phase / lastStatus /
// error here so the AssistantChat header can render them inline (e.g.
// "loading session…", "session: claude-haiku-4-5", "[error] …").
// Without this surface every "no response" looks identical to the user
// — empty asst turn, no signal whether the session is hung in init,
// failed to spawn, or just slow.

export interface ChatStatus {
  phase: string;
  lastStatus: string;
  error: string | null;
}

let _status: ChatStatus = { phase: 'init', lastStatus: '', error: null };
const _statusSubs = new Set<() => void>();

export function setChatStatus(next: ChatStatus): void {
  if (
    _status.phase === next.phase &&
    _status.lastStatus === next.lastStatus &&
    _status.error === next.error
  ) return;
  _status = next;
  for (const s of _statusSubs) s();
}

function _subscribeStatus(fn: () => void): () => void {
  _statusSubs.add(fn);
  return () => { _statusSubs.delete(fn); };
}
function _getStatus(): ChatStatus { return _status; }

export function useChatStatus(): ChatStatus {
  return React.useSyncExternalStore(_subscribeStatus, _getStatus, _getStatus);
}
