/**
 * Encoding utilities — hex, base64.
 * Pure format conversions, no crypto, no bridge dependency.
 */

// ── Hex ───────────────────────────────────────────────

const HEX = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += HEX[bytes[i] >> 4];
    result += HEX[bytes[i] & 0xf];
  }
  return result;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const hi = parseInt(hex[i], 16);
    const lo = parseInt(hex[i + 1], 16);
    if (isNaN(hi) || isNaN(lo)) throw new Error('Invalid hex character');
    bytes[i / 2] = (hi << 4) | lo;
  }
  return bytes;
}

// ── Base64 (format conversion, not cryptography) ────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    result += B64[(a >> 2) & 63];
    result += B64[((a << 4) | (b >> 4)) & 63];
    result += i + 1 < len ? B64[((b << 2) | (c >> 6)) & 63] : '=';
    result += i + 2 < len ? B64[c & 63] : '=';
  }
  return result;
}

export function fromBase64(str: string): Uint8Array {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  let len = str.length;
  while (len > 0 && str[len - 1] === '=') len--;

  const bytes = new Uint8Array(Math.floor(len * 3 / 4));
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[str.charCodeAt(i)];
    const b = i + 1 < len ? lookup[str.charCodeAt(i + 1)] : 0;
    const c = i + 2 < len ? lookup[str.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? lookup[str.charCodeAt(i + 3)] : 0;
    bytes[j++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[j++] = ((b << 4) | (c >> 2)) & 255;
    if (i + 3 < len) bytes[j++] = ((c << 6) | d) & 255;
  }
  return bytes.slice(0, j);
}
