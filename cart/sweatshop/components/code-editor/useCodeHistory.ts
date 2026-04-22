import { useState, useCallback } from 'react';

export interface CodeHistory {
  value: string;
  setValue: (v: string) => void;
  push: (v: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCodeHistory(initial: string): CodeHistory {
  const [history, setHistory] = useState<string[]>([initial]);
  const [index, setIndex] = useState(0);

  const push = useCallback((v: string) => {
    setHistory((prev) => {
      const next = [...prev.slice(0, index + 1), v];
      if (next.length > 200) next.shift();
      return next;
    });
    setIndex((i) => Math.min(index + 1, 199));
  }, [index]);

  const undo = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const redo = useCallback(() => {
    setIndex((i) => Math.min(history.length - 1, i + 1));
  }, [history.length]);

  const setValue = useCallback((v: string) => {
    setHistory([v]);
    setIndex(0);
  }, []);

  return {
    value: history[index] ?? initial,
    setValue,
    push,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
}
