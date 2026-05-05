// App-shell undo/redo action model. Text editors have their own history;
// this system covers cross-panel user-state mutations (settings, theme,
// keybinds, layout, media imports, etc).
//
// Every action is a named, reversible closure pair. `do` re-applies the
// forward change; `undo` rolls it back. Snapshots are optional — kept
// around for diagnostics / history rendering only, not required for
// correctness (the closures are the source of truth).
export type UndoableAction = {
  id: string;         // unique per push; used as React key in history UI
  name: string;       // short human-readable label ("Set theme: sharp")
  category: string;   // 'settings' | 'theme' | 'keybinds' | 'layout' | 'media' | ...
  source?: string;    // originating panel id, optional
  at: number;         // Date.now() when pushed
  do: () => void;     // re-apply forward change (used by redo)
  undo: () => void;   // revert change
  snapshotBefore?: any;
  snapshotAfter?: any;
  groupKey?: string;  // coalesce contiguous actions with same groupKey (e.g. dragging a slider)
};

// User-controlled category toggles. Actions pushed under a disabled
// category skip the stack entirely so the user never sees them in
// history. Stored as a comma-separated deny-list for forward compat.
export const UNDO_CATEGORIES: string[] = [
  'settings', 'theme', 'keybinds', 'layout', 'media', 'plan', 'other',
];
