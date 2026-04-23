const { useCallback } = require('react');

import { usePersistentState } from './usePersistentState';

export interface PresentationState {
  deckPath: string;
  slideIndex: number;
  notesOpen: boolean;
  startedAtMs: number;
  durationMinutes: number;
  warningMinutes: number;
}

const DEFAULT_STATE: PresentationState = {
  deckPath: 'cart/sweatshop/FEATURES.md',
  slideIndex: 0,
  notesOpen: true,
  startedAtMs: 0,
  durationMinutes: 20,
  warningMinutes: 5,
};

export function usePresentationState() {
  const [state, setState] = usePersistentState<PresentationState>('sweatshop.presentation', DEFAULT_STATE);

  const setDeckPath = useCallback((deckPath: string) => {
    const path = String(deckPath || '').trim();
    if (!path) return;
    setState((prev) => ({
      ...prev,
      deckPath: path,
      slideIndex: 0,
      startedAtMs: Date.now(),
    }));
  }, [setState]);

  const setSlideIndex = useCallback((slideIndex: number) => {
    setState((prev) => ({
      ...prev,
      slideIndex: Math.max(0, Math.floor(Number(slideIndex) || 0)),
    }));
  }, [setState]);

  const nextSlide = useCallback(() => setState((prev) => ({ ...prev, slideIndex: prev.slideIndex + 1 })), [setState]);
  const prevSlide = useCallback(() => setState((prev) => ({ ...prev, slideIndex: Math.max(0, prev.slideIndex - 1) })), [setState]);
  const firstSlide = useCallback(() => setSlideIndex(0), [setSlideIndex]);
  const toggleNotes = useCallback(() => setState((prev) => ({ ...prev, notesOpen: !prev.notesOpen })), [setState]);
  const setDurationMinutes = useCallback((durationMinutes: number) => {
    const next = Math.max(1, Math.min(180, Math.round(Number(durationMinutes) || DEFAULT_STATE.durationMinutes)));
    setState((prev) => ({ ...prev, durationMinutes: next }));
  }, [setState]);
  const setWarningMinutes = useCallback((warningMinutes: number) => {
    const next = Math.max(0, Math.min(60, Math.round(Number(warningMinutes) || DEFAULT_STATE.warningMinutes)));
    setState((prev) => ({ ...prev, warningMinutes: next }));
  }, [setState]);
  const resetTimer = useCallback(() => setState((prev) => ({ ...prev, startedAtMs: Date.now() })), [setState]);

  const elapsedMs = state.startedAtMs > 0 ? Math.max(0, Date.now() - state.startedAtMs) : 0;

  return {
    state,
    elapsedMs,
    setDeckPath,
    setSlideIndex,
    nextSlide,
    prevSlide,
    firstSlide,
    toggleNotes,
    setDurationMinutes,
    setWarningMinutes,
    resetTimer,
  };
}
