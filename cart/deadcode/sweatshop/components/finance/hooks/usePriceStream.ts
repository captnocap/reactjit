// usePriceStream — polls live price + history from CoinGecko at a caller-
// configurable interval. No mocked prices: if the API errors or is
// rate-limited, the hook surfaces error/rateLimited and the panel shows the
// banner. Uses the shared useAPI base so rate-limit bookkeeping is honored.


import { useAPI, qs } from '../../../lib/apis/base';
import { useServiceKey } from '../../../lib/apis/useServiceKey';

export type Timeframe = '1h' | '1d' | '7d' | '30d';

export interface PriceSample { t: number; price: number; }
export interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h?: number;
  low_24h?: number;
  ath?: number;
  atl?: number;
}

const BASE = 'https://api.coingecko.com/api/v3';

function timeframeToDays(tf: Timeframe): string {
  if (tf === '1h') return '0.04';  // ~1h
  if (tf === '1d') return '1';
  if (tf === '7d') return '7';
  return '30';
}

export interface PriceStream {
  markets: MarketRow[];
  history: PriceSample[];
  loading: boolean;
  error: Error | null;
  rateLimited: boolean;
  status: number | null;
  refetch: () => void;
  lastUpdate: number;
}

export interface PriceStreamOptions {
  ids: string[];                // coingecko ids (e.g. ['bitcoin','ethereum'])
  selected: string;             // focused id for the detail chart
  currency: string;             // 'usd' / 'eur' / ...
  timeframe: Timeframe;
  intervalMs?: number;          // poll period; default 30_000
}

export function usePriceStream(opts: PriceStreamOptions): PriceStream {
  const keys = useServiceKey('coingecko');
  const apiKey = keys.apiKey;
  const headers = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};
  const interval = opts.intervalMs ?? 30_000;

  const marketsUrl = opts.ids.length > 0
    ? BASE + '/coins/markets?' + qs({
        vs_currency: opts.currency,
        ids: opts.ids.join(','),
        per_page: opts.ids.length,
        page: 1,
        sparkline: false,
      })
    : null;

  const historyUrl = opts.selected
    ? BASE + '/coins/' + opts.selected + '/market_chart?' + qs({
        vs_currency: opts.currency,
        days: timeframeToDays(opts.timeframe),
      })
    : null;

  const marketsRes = useAPI<MarketRow[]>(marketsUrl, { headers, timeout: 10000 });
  const historyRes = useAPI<{ prices: Array<[number, number]> }>(historyUrl, { headers, timeout: 10000 });

  const [tick, setTick] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(0);

  // Periodic refetch. Both endpoints are reloaded on the same cadence so the
  // chart and the ticker never drift.
  useEffect(() => {
    if (interval <= 0) return;
    const id = setInterval(() => {
      setTick((x: number) => x + 1);
      marketsRes.refetch();
      historyRes.refetch();
      setLastUpdate(Date.now());
    }, Math.max(5000, interval));
    return () => clearInterval(id);
  }, [interval, marketsRes.refetch, historyRes.refetch, opts.ids.join(','), opts.selected, opts.currency, opts.timeframe]);

  useEffect(() => {
    if (marketsRes.data && !marketsRes.loading) setLastUpdate(Date.now());
  }, [marketsRes.data, marketsRes.loading]);

  const history: PriceSample[] = historyRes.data?.prices
    ? historyRes.data.prices.map((p) => ({ t: p[0], price: p[1] }))
    : [];

  const loading = marketsRes.loading || historyRes.loading;
  const error = marketsRes.error || historyRes.error;
  const rateLimited = !!(marketsRes.rateLimited || historyRes.rateLimited);
  const status = historyRes.status ?? marketsRes.status;

  return {
    markets: marketsRes.data || [],
    history,
    loading,
    error,
    rateLimited,
    status,
    refetch: () => { marketsRes.refetch(); historyRes.refetch(); setLastUpdate(Date.now()); },
    lastUpdate,
  };
}
