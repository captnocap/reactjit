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
import { INITIAL_TURNS } from './fixtures';
import type { AssistantTurn } from './types';

let _turns: AssistantTurn[] = INITIAL_TURNS;
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
