import { useEffect } from 'react';
import { useAPI } from '../../../lib/apis/base';
import { getWalletNetwork, type WalletAccount, type WalletTransaction } from '../lib';

const POLL_MS = 45_000;
const LIMIT = 50;

function listAddresses(tx: any, key: 'inputs' | 'outputs'): string[] {
  const items = Array.isArray(tx?.[key]) ? tx[key] : [];
  const out: string[] = [];
  for (const item of items) {
    for (const address of item?.addresses || []) {
      const clean = String(address || '').trim();
      if (clean && !out.includes(clean)) out.push(clean);
    }
  }
  return out;
}

function mapTx(account: WalletAccount, tx: any): WalletTransaction {
  const network = getWalletNetwork(account.address);
  const addr = account.address.toLowerCase();
  const inputs = listAddresses(tx, 'inputs');
  const outputs = listAddresses(tx, 'outputs');
  const inputHit = inputs.some((item) => item.toLowerCase() === addr);
  const outputHit = outputs.some((item) => item.toLowerCase() === addr);
  const direction = inputHit && outputHit ? 'self'
    : inputHit ? 'sent'
    : outputHit ? 'received'
    : 'other';
  const kind: 'transfer' | 'self' = direction === 'self' ? 'self' : 'transfer';
  const amountRaw = Number(tx.total || 0);
  const feeRaw = Number(tx.fees || 0);
  const from = inputs.find((item) => item.toLowerCase() !== addr) || inputs[0] || account.address;
  const to = outputs.find((item) => item.toLowerCase() !== addr) || outputs[0] || account.address;
  const counterparty = direction === 'sent' ? to : from;
  const timestamp = new Date(tx.confirmed || tx.received || Date.now()).getTime();
  const confirmations = Number(tx.confirmations || 0);
  return {
    hash: String(tx.hash || ''),
    direction,
    kind,
    amount: amountRaw / Math.pow(10, network.decimals),
    fee: feeRaw / Math.pow(10, network.decimals),
    timestamp,
    confirmations,
    status: tx.confirmed ? 'confirmed' : 'pending',
    from,
    to,
    counterparty,
    raw: tx,
  };
}

export function useTxHistory(account: WalletAccount) {
  const network = getWalletNetwork(account.address);
  const historyUrl = `${network.explorer}/addrs/${encodeURIComponent(account.address)}/full?limit=${LIMIT}`;
  const historyRes = useAPI<any>(historyUrl, { timeout: 15_000 });
  const [lastUpdated, setLastUpdated] = React.useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      historyRes.refetch();
      setLastUpdated(Date.now());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [historyRes.refetch, account.address]);

  useEffect(() => {
    if (historyRes.data && !historyRes.loading) setLastUpdated(Date.now());
  }, [historyRes.data, historyRes.loading]);

  const transactions: WalletTransaction[] = Array.isArray(historyRes.data?.txs)
    ? historyRes.data.txs.map((tx: any) => mapTx(account, tx)).sort((a, b) => b.timestamp - a.timestamp)
    : [];

  return {
    networkId: network.id,
    networkLabel: network.label,
    symbol: network.symbol,
    transactions,
    loading: historyRes.loading,
    error: historyRes.error,
    rateLimited: historyRes.rateLimited,
    lastUpdated,
    refetch: historyRes.refetch,
  };
}
