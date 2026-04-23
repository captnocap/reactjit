import type { UndoableAction } from './UndoableAction';

// Module-level singleton stack. Every panel calls push() / undo() /
// redo() against the same instance so keybinds can drive undo from
// anywhere. Subscribers re-render via subscribe().

const DEFAULT_MAX_DEPTH = 200;
const MAX_DEPTH_KEY = 'sweatshop:undo:maxDepth';
const DISABLED_KEY = 'sweatshop:undo:disabledCategories';
const COALESCE_MS = 400;

let undoStack: UndoableAction[] = [];
let redoStack: UndoableAction[] = [];
let maxDepth: number = loadMaxDepth();
let disabledCategories: Set<string> = loadDisabledCategories();

const listeners = new Set<() => void>();

function loadMaxDepth(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_MAX_DEPTH;
    const raw = localStorage.getItem(MAX_DEPTH_KEY);
    const n = raw ? Number(raw) : DEFAULT_MAX_DEPTH;
    return Number.isFinite(n) && n > 0 ? Math.min(5000, Math.floor(n)) : DEFAULT_MAX_DEPTH;
  } catch (_e) { return DEFAULT_MAX_DEPTH; }
}

function loadDisabledCategories(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(DISABLED_KEY);
    if (!raw) return new Set();
    return new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean));
  } catch (_e) { return new Set(); }
}

function persistMaxDepth() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(MAX_DEPTH_KEY, String(maxDepth)); } catch (_e) {}
}

function persistDisabled() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(DISABLED_KEY, Array.from(disabledCategories).join(',')); } catch (_e) {}
}

function notify() { for (const fn of listeners) fn(); }

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getUndoDepth(): number { return undoStack.length; }
export function getRedoDepth(): number { return redoStack.length; }
export function getUndoStack(): UndoableAction[] { return undoStack.slice(); }
export function getRedoStack(): UndoableAction[] { return redoStack.slice(); }

export function getMaxDepth(): number { return maxDepth; }
export function setMaxDepth(value: number): void {
  const n = Math.max(1, Math.min(5000, Math.floor(value)));
  maxDepth = n;
  while (undoStack.length > maxDepth) undoStack.shift();
  persistMaxDepth();
  notify();
}

export function getDisabledCategories(): string[] { return Array.from(disabledCategories); }
export function isCategoryEnabled(category: string): boolean { return !disabledCategories.has(category); }
export function setCategoryEnabled(category: string, enabled: boolean): void {
  if (enabled) disabledCategories.delete(category);
  else disabledCategories.add(category);
  persistDisabled();
  notify();
}

export function push(action: UndoableAction): void {
  if (!isCategoryEnabled(action.category)) return;

  // Coalesce contiguous same-groupKey actions within COALESCE_MS — keeps
  // slider drags and rapid edits as a single undo step.
  const top = undoStack[undoStack.length - 1];
  if (top && action.groupKey && top.groupKey === action.groupKey && (action.at - top.at) <= COALESCE_MS) {
    top.do = action.do;
    top.snapshotAfter = action.snapshotAfter;
    top.at = action.at;
    top.name = action.name;
    redoStack = [];
    notify();
    return;
  }

  undoStack.push(action);
  while (undoStack.length > maxDepth) undoStack.shift();
  redoStack = [];
  notify();
}

export function undo(): UndoableAction | null {
  const action = undoStack.pop();
  if (!action) return null;
  try { action.undo(); } catch (_e) {}
  redoStack.push(action);
  notify();
  return action;
}

export function redo(): UndoableAction | null {
  const action = redoStack.pop();
  if (!action) return null;
  try { action.do(); } catch (_e) {}
  undoStack.push(action);
  notify();
  return action;
}

// Jump-to: undo or redo repeatedly until the given action is on top.
// Returns how many steps were taken (signed: positive = undos, negative
// = redos).
export function jumpTo(actionId: string): number {
  const idxUndo = undoStack.findIndex((a) => a.id === actionId);
  if (idxUndo >= 0) {
    const steps = undoStack.length - 1 - idxUndo;
    for (let i = 0; i < steps; i++) undo();
    return steps;
  }
  const idxRedo = redoStack.findIndex((a) => a.id === actionId);
  if (idxRedo >= 0) {
    const steps = redoStack.length - idxRedo;
    for (let i = 0; i < steps; i++) redo();
    return -steps;
  }
  return 0;
}

export function clear(): void {
  undoStack = [];
  redoStack = [];
  notify();
}
