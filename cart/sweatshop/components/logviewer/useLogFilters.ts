import type { LogEntry, LogLevel } from './useLogStream';

export interface LogFilterState {
  levels: Set<LogLevel>;
  categories: Set<string>;
  search: string;
  timeFrom: number | null;
  timeTo: number | null;
}

const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function useLogFilters() {
  const [state, setState] = useState<LogFilterState>({
    levels: new Set(ALL_LEVELS),
    categories: new Set(),
    search: '',
    timeFrom: null,
    timeTo: null,
  });

  const toggleLevel = useCallback((level: LogLevel) => {
    setState((prev: LogFilterState) => {
      const next = new Set(prev.levels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return { ...prev, levels: next };
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setState((prev: LogFilterState) => {
      const next = new Set(prev.categories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { ...prev, categories: next };
    });
  }, []);

  const setSearch = useCallback((search: string) => {
    setState((prev: LogFilterState) => ({ ...prev, search }));
  }, []);

  const setTimeRange = useCallback((from: number | null, to: number | null) => {
    setState((prev: LogFilterState) => ({ ...prev, timeFrom: from, timeTo: to }));
  }, []);

  const applyFilter = useCallback(
    (entry: LogEntry) => {
      if (!state.levels.has(entry.level)) return false;
      if (state.categories.size > 0 && !state.categories.has(entry.category)) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        if (!entry.message.toLowerCase().includes(q) && !entry.category.toLowerCase().includes(q)) return false;
      }
      if (state.timeFrom && entry.timestamp < state.timeFrom) return false;
      if (state.timeTo && entry.timestamp > state.timeTo) return false;
      return true;
    },
    [state]
  );

  const allCategories = useMemo(() => {
    // Placeholder: caller should pass actual categories from stream
    return new Set<string>();
  }, []);

  return {
    state,
    toggleLevel,
    toggleCategory,
    setSearch,
    setTimeRange,
    applyFilter,
    allLevels: ALL_LEVELS,
  };
}
