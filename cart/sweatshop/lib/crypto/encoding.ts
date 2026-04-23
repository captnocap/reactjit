const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP: Record<string, number> = B58.split('').reduce((acc, ch, idx) => {
  acc[ch] = idx;
  return acc;
}, {} as Record<string, number>);

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

export function utf8ToBytes(text: string): Uint8Array {
  if (encoder) return encoder.encode(text);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function bytesToUtf8(bytes: Uint8Array): string {
  if (decoder) return decoder.decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const raw = String(hex || '').replace(/\s+/g, '').trim();
  if (!raw) return new Uint8Array(0);
  if (raw.length % 2 !== 0) throw new Error('Invalid hex string length');
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) {
    const n = Number.parseInt(raw.slice(i, i + 2), 16);
    if (!Number.isFinite(n)) throw new Error('Invalid hex string');
    out[i / 2] = n;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const normalized = String(text || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized) return new Uint8Array(0);
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const clean = padded.replace(/[^A-Za-z0-9+/=]/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = clean[i + 2] === '=' ? -1 : B64.indexOf(clean[i + 2]);
    const d = clean[i + 3] === '=' ? -1 : B64.indexOf(clean[i + 3]);
    if (a < 0 || b < 0) throw new Error('Invalid base64 string');
    out[offset++] = (a << 2) | (b >> 4);
    if (c >= 0) out[offset++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[offset++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, offset);
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(text: string): Uint8Array {
  return fromBase64(String(text || '').replace(/-/g, '+').replace(/_/g, '/'));
}

export function toBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let digits = [0];
  for (let i = 0; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      const n = digits[j] * 256 + carry;
      digits[j] = n % 58;
      carry = Math.floor(n / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i += 1) out += '1';
  for (let i = digits.length - 1; i >= 0; i -= 1) out += B58[digits[i]];
  return out;
}

export function fromBase58(text: string): Uint8Array {
  const raw = String(text || '').trim();
  if (!raw) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < raw.length; i += 1) {
    const value = B58_MAP[raw[i]];
    if (value === undefined) throw new Error('Invalid base58 string');
    let carry = value;
    for (let j = 0; j < bytes.length; j += 1) {
      const n = bytes[j] * 58 + carry;
      bytes[j] = n & 0xff;
      carry = n >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < raw.length && raw[i] === '1'; i += 1) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}
