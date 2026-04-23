
import type { Query } from './types';
import type { DocStore } from './doc-store';

/** Reactive query hook against a DocStore collection. */
export function useQuery(
  store: DocStore,
  collection: string,
  query?: Query,
  deps: any[] = [],
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    store.list(collection, query)
      .then(items => {
        if (!cancelled) setData(items);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collection, version, ...deps]);

  return { data, loading, error, refetch };
}
