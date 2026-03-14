import type { ImagingHistoryEntry, ImagingHistoryState } from './types';

function cloneState<TState>(state: TState): TState {
  return JSON.parse(JSON.stringify(state));
}

export interface UseImagingHistoryResult<TState> {
  history: ImagingHistoryState<TState>;
  canUndo: boolean;
  canRedo: boolean;
  commit: (state: TState, label: string) => void;
  undo: () => void;
  redo: () => void;
}

export function createImagingHistoryEntry<TState>(state: TState, label: string): ImagingHistoryEntry<TState> {
  return {
    id: `hist_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label,
    timestamp: Date.now(),
    state: cloneState(state),
  };
}

export function createImagingHistoryState<TState>(initialState: TState): ImagingHistoryState<TState> {
  return {
    past: [],
    present: createImagingHistoryEntry(initialState, 'Initial'),
    future: [],
  };
}

export function commitImagingHistory<TState>(
  history: ImagingHistoryState<TState>,
  next: ImagingHistoryEntry<TState>,
): ImagingHistoryState<TState> {
  if (!history.present) {
    return { past: [], present: next, future: [] };
  }
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undoImagingHistory<TState>(history: ImagingHistoryState<TState>): ImagingHistoryState<TState> {
  if (history.past.length === 0 || !history.present) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoImagingHistory<TState>(history: ImagingHistoryState<TState>): ImagingHistoryState<TState> {
  if (history.future.length === 0 || !history.present) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
