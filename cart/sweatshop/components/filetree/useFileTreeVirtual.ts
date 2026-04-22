// ── Windowing Hook ───────────────────────────────────────────────────

const React: any = require('react');
const { useMemo, useState } = React;

export interface VirtualWindow<T> {
  items: T[];
  startIndex: number;
  endIndex: number;
  topSpacer: number;
  bottomSpacer: number;
  totalHeight: number;
  scrollY: number;
  setScrollY: (y: number) => void;
}

export function useFileTreeVirtual<T>(
  allItems: T[],
  rowHeight: number,
  viewportHeight: number,
  overscan = 8
): VirtualWindow<T> {
  const [scrollY, setScrollY] = useState(0);

  const total = allItems.length;
  const totalHeight = total * rowHeight;

  const startIndex = Math.max(0, Math.floor(scrollY / rowHeight) - overscan);
  const endIndex = Math.min(total, Math.ceil((scrollY + viewportHeight) / rowHeight) + overscan);

  const windowed = useMemo(() => {
    return allItems.slice(startIndex, endIndex);
  }, [allItems, startIndex, endIndex]);

  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, (total - endIndex) * rowHeight);

  return {
    items: windowed,
    startIndex,
    endIndex,
    topSpacer,
    bottomSpacer,
    totalHeight,
    scrollY,
    setScrollY,
  };
}
