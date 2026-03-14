/**
 * Financial formatting utilities — currency, percent, compact notation.
 */

/** Format a number as currency: $1,234.56 */
export function formatCurrency(
  value: number,
  opts?: { currency?: string; decimals?: number },
): string {
  const currency = opts?.currency ?? '$';
  const decimals = opts?.decimals ?? (Math.abs(value) >= 1 ? 2 : value === 0 ? 2 : 4);
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = fraction !== undefined ? `${grouped}.${fraction}` : grouped;
  return `${value < 0 ? '-' : ''}${currency}${formatted}`;
}

/** Format as compact: 1.2M, 3.4K, etc. */
export function formatCompact(n: number, decimals: number = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}${(n / 1_000_000_000_000).toFixed(decimals)}T`;
  if (abs >= 1_000_000_000) return `${sign}${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${sign}${(n / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000) return `${sign}${(n / 1_000).toFixed(decimals)}K`;
  return `${sign}${abs.toFixed(decimals === 0 ? 0 : Math.min(decimals, 2))}`;
}

/** Format as percentage: +2.40% or -1.37% */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/** Format volume: 24.1M */
export function formatVolume(n: number): string {
  return formatCompact(n, 1);
}

/** Format a price adaptively based on magnitude */
export function formatPrice(price: number, currency: string = '$'): string {
  if (price >= 10000) return formatCurrency(price, { currency, decimals: 0 });
  if (price >= 1) return formatCurrency(price, { currency, decimals: 2 });
  if (price >= 0.01) return formatCurrency(price, { currency, decimals: 4 });
  return formatCurrency(price, { currency, decimals: 6 });
}

/** Spread as basis points */
export function formatBps(bps: number): string {
  return `${bps.toFixed(1)} bps`;
}

/** Format basis points from two prices */
export function spreadBps(bid: number, ask: number): number {
  const mid = (bid + ask) / 2;
  return mid === 0 ? 0 : ((ask - bid) / mid) * 10000;
}
