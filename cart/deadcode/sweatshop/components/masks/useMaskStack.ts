import { useState, useCallback, useMemo } from 'react';
import { createMaskStackItem, getMaskDef, type MaskStackItem, type MaskKind } from './maskCatalog';

export function useMaskStack() {
  const [stack, setStack] = useState<MaskStackItem[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string>('');

  const selectedItem = useMemo(
    () => stack.find((item) => item.id === selectedStackId) || stack[0] || null,
    [stack, selectedStackId],
  );

  const addMask = useCallback((maskId: MaskKind) => {
    const next = createMaskStackItem(maskId);
    setStack((prev) => [...prev, next]);
    setSelectedStackId(next.id);
  }, []);

  const updateParams = useCallback((itemId: string, propName: string, nextValue: any) => {
    setStack((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, params: { ...item.params, [propName]: nextValue } } : item,
      ),
    );
  }, []);

  const moveMask = useCallback((itemId: string, delta: number) => {
    setStack((prev) => {
      const idx = prev.findIndex((item) => item.id === itemId);
      if (idx < 0) return prev;
      const nextIdx = Math.max(0, Math.min(prev.length - 1, idx + delta));
      if (nextIdx === idx) return prev;
      const next = prev.slice();
      const [picked] = next.splice(idx, 1);
      next.splice(nextIdx, 0, picked);
      return next;
    });
  }, []);

  const toggleMask = useCallback((itemId: string) => {
    setStack((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, enabled: !item.enabled } : item)),
    );
  }, []);

  const removeMask = useCallback((itemId: string) => {
    setStack((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedStackId((current) => (current === itemId ? '' : current));
  }, []);

  const activeStack = useMemo(() => stack.filter((item) => item.enabled), [stack]);

  const selectedDef = selectedItem ? getMaskDef(selectedItem.maskId) : null;

  return {
    stack,
    selectedItem,
    selectedStackId,
    setSelectedStackId,
    addMask,
    updateParams,
    moveMask,
    toggleMask,
    removeMask,
    activeStack,
    selectedDef,
  };
}
