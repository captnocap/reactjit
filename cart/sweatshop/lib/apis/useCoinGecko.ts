import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface CoinGeckoConfig { apiKey?: string; }

export function useCoinGecko(config?: CoinGeckoConfig) {
  const keys = useServiceKey('coingecko');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = 'https://api.coingecko.com/api/v3';
  const headers = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

  const price = (ids: string, currency: string = 'usd') =>
    useAPI<any>(`${base}/simple/price?${qs({ ids, vs_currencies: currency })}`, { headers });
  const coinsList = () => useAPI<any[]>(`${base}/coins/list`, { headers });
  const coinMarket = (currency: string = 'usd', perPage: number = 20) =>
    useAPI<any[]>(`${base}/coins/markets?${qs({ vs_currency: currency, per_page: perPage, page: 1, sparkline: false })}`, { headers });
  const coin = (id: string) =>
    useAPI<any>(id ? `${base}/coins/${id}?localization=false` : null, { headers });

  return { price, coinsList, coinMarket, coin };
}
