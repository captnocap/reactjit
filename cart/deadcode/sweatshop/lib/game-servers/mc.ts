import { bytesToText, textToBytes } from './wire';

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export type MinecraftStatus = {
  description: any;
  players?: { online: number; max: number };
  version?: { name: string };
  favicon?: string;
};

export function buildMinecraftHandshake(host: string, port: number, protocolVersion = 760): Uint8Array {
  const hostBytes = textToBytes(host);
  const body = concatBytes(
    Uint8Array.of(0x00),
    varInt(protocolVersion),
    varString(hostBytes),
    Uint8Array.of((port >> 8) & 0xff, port & 0xff),
    varInt(0x01),
  );
  return packet(body);
}

export function buildMinecraftStatusRequest(): Uint8Array {
  return packet(Uint8Array.of(0x00));
}

function packet(payload: Uint8Array): Uint8Array {
  return concatBytes(varInt(payload.length), payload);
}

function varInt(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let temp = v & 0x7f;
    v >>>= 7;
    if (v !== 0) temp |= 0x80;
    out.push(temp);
  } while (v !== 0);
  return Uint8Array.from(out);
}

function varString(bytes: Uint8Array): Uint8Array {
  return concatBytes(varInt(bytes.length), bytes);
}

export function parseMinecraftStatus(jsonText: string): MinecraftStatus | null {
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export function buildMinecraftJoinCommand(address: string): string {
  return `minecraft://${normalizeAddress(address)}`;
}

function normalizeAddress(address: string): string {
  return String(address || '').trim();
}

