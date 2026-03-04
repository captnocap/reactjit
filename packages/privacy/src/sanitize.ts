import { rpc } from './rpc';
import type { PIIType, PIIMatch, RedactOptions, MaskOptions } from './types';

const PII_PATTERNS: Record<PIIType, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  ipv4: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  ipv6: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
};

export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS) as [PIIType, RegExp][]) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export function maskValue(value: string, opts?: MaskOptions): string {
  const visibleEnd = opts?.visibleEnd ?? 4;
  const visibleStart = opts?.visibleStart ?? 0;
  const maskChar = opts?.maskChar ?? '*';
  const maskLen = Math.max(0, value.length - visibleStart - visibleEnd);
  return value.slice(0, visibleStart) + maskChar.repeat(maskLen) + value.slice(value.length - visibleEnd);
}

export function redactPII(text: string, opts?: RedactOptions): string {
  const typesToCheck = opts?.types ?? (Object.keys(PII_PATTERNS) as PIIType[]);
  const matches: PIIMatch[] = [];
  for (const type of typesToCheck) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  matches.sort((a, b) => b.start - a.start);
  let result = text;
  for (const match of matches) {
    const replacement = opts?.mask ? maskValue(match.value) : (opts?.replacement ?? '[REDACTED]');
    result = result.slice(0, match.start) + replacement + result.slice(match.end);
  }
  return result;
}

export function redactLog(logLine: string): string {
  return redactPII(logLine);
}

export async function tokenize(value: string, salt: string): Promise<string> {
  const r = await rpc<{ hex: string }>('crypto:hmac', { algorithm: 'sha256', key: salt, message: value });
  return r.hex;
}
