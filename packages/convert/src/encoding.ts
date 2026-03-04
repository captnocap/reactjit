import { register } from './registry';

// ── Base64 ──────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function textToBase64(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    const a = text.charCodeAt(i++);
    const b = i < text.length ? text.charCodeAt(i++) : NaN;
    const c = i < text.length ? text.charCodeAt(i++) : NaN;
    const triplet = (a << 16) | (isNaN(b) ? 0 : b << 8) | (isNaN(c) ? 0 : c);
    result += B64[(triplet >> 18) & 0x3f];
    result += B64[(triplet >> 12) & 0x3f];
    result += isNaN(b) ? '=' : B64[(triplet >> 6) & 0x3f];
    result += isNaN(c) ? '=' : B64[triplet & 0x3f];
  }
  return result;
}

export function base64ToText(b64: string): string {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  let result = '';
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    result += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== -1) result += String.fromCharCode(((b & 0xf) << 4) | (c >> 2));
    if (d !== -1) result += String.fromCharCode(((c & 0x3) << 6) | d);
  }
  return result;
}

// ── Hex encoding (text ↔ hex string) ────────────────────

export function textToHex(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += text.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return result;
}

export function hexToText(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return result;
}

// ── URL encoding ────────────────────────────────────────

export function textToUrlEncoded(text: string): string {
  // Manual percent-encoding for QuickJS (no encodeURIComponent)
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (
      (c >= 0x41 && c <= 0x5a) || // A-Z
      (c >= 0x61 && c <= 0x7a) || // a-z
      (c >= 0x30 && c <= 0x39) || // 0-9
      c === 0x2d || c === 0x5f || c === 0x2e || c === 0x7e // - _ . ~
    ) {
      result += text[i];
    } else {
      result += '%' + c.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return result;
}

export function urlEncodedToText(encoded: string): string {
  let result = '';
  let i = 0;
  while (i < encoded.length) {
    if (encoded[i] === '%' && i + 2 < encoded.length) {
      result += String.fromCharCode(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 3;
    } else if (encoded[i] === '+') {
      result += ' ';
      i++;
    } else {
      result += encoded[i];
      i++;
    }
  }
  return result;
}

// ── HTML entities ───────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

const HTML_DECODE: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ',
};

export function textToHtmlEntities(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += HTML_ENTITIES[text[i]] ?? text[i];
  }
  return result;
}

export function htmlEntitiesToText(html: string): string {
  return html.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (match, dec, hex, name) => {
    if (dec) return String.fromCharCode(parseInt(dec, 10));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return HTML_DECODE['&' + name + ';'] ?? match;
  });
}

// ── Registry registration ───────────────────────────────

register('text', 'base64', textToBase64, 'encoding');
register('base64', 'text', base64ToText, 'encoding');
register('text', 'hex-enc', textToHex, 'encoding');
register('hex-enc', 'text', hexToText, 'encoding');
register('text', 'url', textToUrlEncoded, 'encoding');
register('url', 'text', urlEncodedToText, 'encoding');
register('text', 'html', textToHtmlEntities, 'encoding');
register('html', 'text', htmlEntitiesToText, 'encoding');
