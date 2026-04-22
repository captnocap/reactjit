import { useEffect, useRef } from 'react';

export type KeymapMode = 'default' | 'vim' | 'emacs';

export interface KeymapHandlers {
  undo: () => void;
  redo: () => void;
  save: () => void;
  find?: () => void;
}

export function useCodeKeymap(mode: KeymapMode, handlers: KeymapHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (mode === 'vim' || mode === 'emacs') return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? handlersRef.current.redo() : handlersRef.current.undo();
      }
      if (mod && e.key === 's') {
        e.preventDefault();
        handlersRef.current.save();
      }
      if (mod && e.key === 'f') {
        e.preventDefault();
        handlersRef.current.find?.();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [mode]);
}
