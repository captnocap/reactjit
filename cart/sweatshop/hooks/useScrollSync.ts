
export interface ScrollSyncState {
  scrollX: number;
  scrollY: number;
  setScroll: (scrollX: number, scrollY: number) => void;
  onScroll: (payload: any) => void;
}

export function useScrollSync(initial: { scrollX?: number; scrollY?: number } = {}): ScrollSyncState {
  const [scrollX, setScrollX] = useState<number>(Number(initial.scrollX ?? 0));
  const [scrollY, setScrollY] = useState<number>(Number(initial.scrollY ?? 0));

  const setScroll = useCallback((nextX: number, nextY: number) => {
    if (Number.isFinite(nextX)) setScrollX(nextX);
    if (Number.isFinite(nextY)) setScrollY(nextY);
  }, []);

  const onScroll = useCallback((payload: any) => {
    const nextX = typeof payload?.scrollX === 'number' ? payload.scrollX : scrollX;
    const nextY = typeof payload?.scrollY === 'number' ? payload.scrollY : scrollY;
    if (nextX !== scrollX) setScrollX(nextX);
    if (nextY !== scrollY) setScrollY(nextY);
  }, [scrollX, scrollY]);

  return { scrollX, scrollY, setScroll, onScroll };
}
