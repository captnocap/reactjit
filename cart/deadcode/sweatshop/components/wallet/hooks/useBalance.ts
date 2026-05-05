import { useEffect } from 'react';
import { useAPI } from '../../../lib/apis/base';
import { useCoinGecko } from '../../../lib/apis/useCoinGecko';
import { formatAtomic, getWalletNetwork, type WalletAccount } from '../lib';

const POLL_MS = 30_000;

export interface WalletBalanceState {
  networkId: 'ethereum' | 'bitcoin';
  networkLabel: string;
  symbol: string;
  nativeRaw: number | string;
  native: string;
  usd: number;
  eur: number;
  gbp: number;
  loading: boolean;
  error: Error | null;
  rateLimited: boolean;
  lastUpdated: number;
  refetch: () => void;
}

export function useBalance(account: WalletAccount): WalletBalanceState {
  const network = getWalletNetwork(account.address);
  const balanceUrl = `${network.explorer}/addrs/${encodeURIComponent(account.address)}/balance`;
  const balanceRes = useAPI<any>(balanceUrl, { timeout: 12_000 });
  const cg = useCoinGecko();
  const priceRes = cg.price(network.assetId, 'usd,eur,gbp');
  const [lastUpdated, setLastUpdated] = React.useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      balanceRes.refetch();
      priceRes.refetch();
      setLastUpdated(Date.now());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [balanceRes.refetch, priceRes.refetch, account.address]);

  useEffect(() => {
    if (balanceRes.data && !balanceRes.loading) setLastUpdated(Date.now());
  }, [balanceRes.data, balanceRes.loading]);

  const nativeRaw = balanceRes.data?.final_balance ?? balanceRes.data?.balance ?? 0;
  const native = formatAtomic(nativeRaw, network.decimals, network.id === 'bitcoin' ? 8 : 6);
  const prices = priceRes.data?.[network.assetId] || {};
  const nativeNumber = Number(native.replace(/,/g, ''));
  const usd = nativeNumber * Number(prices.usd || 0);
  const eur = nativeNumber * Number(prices.eur || 0);
  const gbp = nativeNumber * Number(prices.gbp || 0);

  return {
    networkId: network.id,
    networkLabel: network.label,
    symbol: network.symbol,
    nativeRaw,
    native,
    usd,
    eur,
    gbp,
    loading: balanceRes.loading || priceRes.loading,
    error: balanceRes.error || priceRes.error,
    rateLimited: balanceRes.rateLimited || priceRes.rateLimited,
    lastUpdated,
    refetch: () => {
      balanceRes.refetch();
      priceRes.refetch();
      setLastUpdated(Date.now());
    },
  };
}
