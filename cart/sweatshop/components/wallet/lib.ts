export type WalletNetworkId = 'ethereum' | 'bitcoin';

export interface WalletAccount {
  id: string;
  label: string;
  address: string;
}

export interface WalletContact {
  id: string;
  label: string;
  address: string;
}

export interface WalletNetworkConfig {
  id: WalletNetworkId;
  label: string;
  symbol: string;
  assetId: string;
  decimals: number;
  tone: string;
  explorer: string;
}

export interface WalletTransaction {
  hash: string;
  direction: 'sent' | 'received' | 'self' | 'other';
  kind: 'transfer' | 'self';
  amount: number;
  fee: number;
  timestamp: number;
  confirmations: number;
  status: 'confirmed' | 'pending';
  from: string;
  to: string;
  counterparty: string;
  raw: any;
}

export type WalletFeeLevel = 'slow' | 'standard' | 'fast';

export interface WalletPaymentRequest {
  network: WalletNetworkId;
  label: string;
  recipient: string;
  amount: string;
  feeLevel: WalletFeeLevel;
  uri: string;
  summary: string;
}

export const WALLET_NETWORKS: Record<WalletNetworkId, WalletNetworkConfig> = {
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum',
    symbol: 'ETH',
    assetId: 'ethereum',
    decimals: 18,
    tone: '#79c0ff',
    explorer: 'https://api.blockcypher.com/v1/eth/main',
  },
  bitcoin: {
    id: 'bitcoin',
    label: 'Bitcoin',
    symbol: 'BTC',
    assetId: 'bitcoin',
    decimals: 8,
    tone: '#f7931a',
    explorer: 'https://api.blockcypher.com/v1/btc/main',
  },
};

export const WALLET_FEE_PRESETS: Record<WalletNetworkId, Array<{ id: WalletFeeLevel; label: string; hint: string }>> = {
  ethereum: [
    { id: 'slow', label: 'Slow', hint: 'lower gwei' },
    { id: 'standard', label: 'Standard', hint: 'balanced' },
    { id: 'fast', label: 'Fast', hint: 'higher gwei' },
  ],
  bitcoin: [
    { id: 'slow', label: 'Slow', hint: 'low sats/vB' },
    { id: 'standard', label: 'Standard', hint: 'balanced' },
    { id: 'fast', label: 'Fast', hint: 'high sats/vB' },
  ],
};

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAddress(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

export function compactAddress(address: string): string {
  const clean = normalizeAddress(address);
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

export function detectWalletNetwork(address: string): WalletNetworkId {
  const clean = normalizeAddress(address).toLowerCase();
  if (clean.startsWith('0x') && clean.length >= 40) return 'ethereum';
  if (/^(bc1|[13])[a-z0-9]{20,}$/i.test(clean)) return 'bitcoin';
  return 'ethereum';
}

export function getWalletNetwork(address: string): WalletNetworkConfig {
  return WALLET_NETWORKS[detectWalletNetwork(address)];
}

export function networkBadgeTone(network: WalletNetworkId): string {
  return WALLET_NETWORKS[network].tone;
}

export function formatAtomic(raw: number | string | null | undefined, decimals: number, precision = 6): string {
  const safe = String(raw == null ? '0' : raw).replace(/[^\d-]/g, '');
  const value = safe ? BigInt(safe) : 0n;
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, Math.max(0, precision));
  const trimmed = fractionText.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${trimmed ? '.' + trimmed : ''}`;
}

export function formatFiat(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function formatTimestamp(value: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export function parseDecimalToAtomicString(value: string, decimals: number): string {
  const clean = String(value || '').trim();
  if (!clean) return '0';
  const negative = clean.startsWith('-');
  const normalized = negative ? clean.slice(1) : clean;
  const [wholeRaw, fracRaw = ''] = normalized.split('.');
  const whole = wholeRaw.replace(/[^\d]/g, '') || '0';
  const fraction = fracRaw.replace(/[^\d]/g, '').slice(0, decimals).padEnd(decimals, '0');
  const atomic = BigInt(whole || '0') * (10n ** BigInt(decimals)) + BigInt(fraction || '0');
  return `${negative ? '-' : ''}${atomic.toString()}`;
}

export function buildPaymentUri(network: WalletNetworkConfig, recipient: string, amount: string): string {
  const cleanRecipient = normalizeAddress(recipient);
  const cleanAmount = String(amount || '').trim();
  if (!cleanRecipient) return '';
  if (network.id === 'bitcoin') {
    return cleanAmount ? `bitcoin:${cleanRecipient}?amount=${cleanAmount}` : `bitcoin:${cleanRecipient}`;
  }
  const atomic = cleanAmount ? parseDecimalToAtomicString(cleanAmount, network.decimals) : '';
  return atomic ? `ethereum:${cleanRecipient}@1?value=${atomic}` : `ethereum:${cleanRecipient}@1`;
}

export function buildPaymentRequest(account: WalletAccount, recipient: string, amount: string, feeLevel: WalletFeeLevel): WalletPaymentRequest {
  const network = getWalletNetwork(account.address);
  const uri = buildPaymentUri(network, recipient, amount);
  const summary = [
    'Watch-only wallet handoff',
    `Network: ${network.label}`,
    `Source: ${account.label} (${compactAddress(account.address)})`,
    `Recipient: ${normalizeAddress(recipient)}`,
    `Amount: ${String(amount || '').trim() || '0'} ${network.symbol}`,
    `Fee: ${feeLevel}`,
    `URI: ${uri}`,
  ].join('\n');
  return {
    network: network.id,
    label: network.label,
    recipient: normalizeAddress(recipient),
    amount: String(amount || '').trim(),
    feeLevel,
    uri,
    summary,
  };
}

function hash32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function xorshift32(state: { value: number }): number {
  let x = state.value || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.value = x >>> 0;
  return state.value;
}

export function buildQrMatrix(payload: string, size = 29): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved = new Set<string>();
  const mark = (x: number, y: number, on: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    matrix[y][x] = on;
    reserved.add(`${x},${y}`);
  };
  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const border = x === 0 || y === 0 || x === 6 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        mark(ox + x, oy + y, border || center);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    mark(i, 6, i % 2 === 0);
    mark(6, i, i % 2 === 0);
  }

  const state = { value: hash32(payload || 'wallet') || 0x12345678 };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (reserved.has(`${x},${y}`)) continue;
      const bit = xorshift32(state);
      matrix[y][x] = (bit & 1) === 1;
    }
  }

  return matrix;
}

export function readableAddressLine(address: string): string {
  const clean = normalizeAddress(address);
  return clean ? `${compactAddress(clean)} · ${clean}` : '—';
}

