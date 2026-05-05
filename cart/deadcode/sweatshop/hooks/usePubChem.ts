import { fetchPubChemCompound, fetchPubChemStructureSvg, isPubChemAvailable, searchPubChemCompounds, type PubChemCompound, type PubChemSearchResult } from '../lib/chemistry/pubchem';

export type PubChemState = {
  supported: boolean;
  loading: boolean;
  query: string;
  results: PubChemSearchResult[];
  compound: PubChemCompound | null;
  error: string | null;
};

export function usePubChem(query: string): PubChemState {
  const supported = useMemo(() => isPubChemAvailable(), []);
  const [state, setState] = useState<PubChemState>({
    supported,
    loading: false,
    query: '',
    results: [],
    compound: null,
    error: null,
  });

  useEffect(() => {
    const q = String(query || '').trim();
    if (!supported) {
      setState((prev) => ({ ...prev, supported: false, loading: false, query: q, results: [], compound: null, error: null }));
      return;
    }
    if (!q) {
      setState((prev) => ({ ...prev, loading: false, query: q, results: [], compound: null, error: null }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, query: q, error: null }));
    const timer = setTimeout(() => {
      (async () => {
        try {
          const results = await searchPubChemCompounds(q, 6);
          if (cancelled) return;
          const top = results[0] || null;
          let compound: PubChemCompound | null = null;
          if (top) {
            compound = await fetchPubChemCompound(top.cid);
            if (compound && compound.cid) {
              const svg = await fetchPubChemStructureSvg(compound.cid);
              if (cancelled) return;
              compound = { ...compound, structureSvg: svg };
            }
          }
          if (cancelled) return;
          setState({ supported: true, loading: false, query: q, results, compound, error: null });
        } catch (error: any) {
          if (cancelled) return;
          setState({ supported: true, loading: false, query: q, results: [], compound: null, error: error?.message || String(error) });
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, supported]);

  return state;
}
