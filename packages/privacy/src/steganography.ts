import { rpc } from './rpc';
import type { StegResult } from './types';

const ZWS = '\u200B';
const ZWNJ = '\u200C';

export async function stegEmbedImage(imagePath: string, data: string, outputPath: string): Promise<StegResult> {
  return rpc<StegResult>('privacy:steg:embedImage', { imagePath, data, outputPath });
}

export async function stegExtractImage(imagePath: string): Promise<string> {
  const r = await rpc<{ data: string }>('privacy:steg:extractImage', { imagePath });
  return r.data;
}

export function stegEmbedWhitespace(carrier: string, secret: string): string {
  const bytes = [];
  for (let i = 0; i < secret.length; i++) {
    bytes.push(secret.charCodeAt(i));
  }
  const binary = bytes.map(b => b.toString(2).padStart(8, '0')).join('');

  const chars = Array.from(carrier);
  if (chars.length < 2) return carrier;

  let result = chars[0];
  let bitIdx = 0;
  for (let i = 1; i < chars.length; i++) {
    while (bitIdx < binary.length) {
      result += binary[bitIdx] === '0' ? ZWS : ZWNJ;
      bitIdx++;
    }
    result += chars[i];
  }
  return result;
}

export function stegExtractWhitespace(text: string): string {
  let binary = '';
  for (const ch of text) {
    if (ch === ZWS) binary += '0';
    else if (ch === ZWNJ) binary += '1';
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= binary.length; i += 8) {
    bytes.push(parseInt(binary.slice(i, i + 8), 2));
  }

  return String.fromCharCode(...bytes);
}
