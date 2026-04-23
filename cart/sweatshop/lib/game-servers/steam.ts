import { bytesToText, textToBytes } from './wire';

const HEADER = Uint8Array.of(0xff, 0xff, 0xff, 0xff);

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

export type SteamBrowserServer = {
  address: string;
  name: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  ping?: number;
  tags?: string[];
};

export function buildMasterServerRequest(lastAddress = '0.0.0.0:0', filter = ''): Uint8Array {
  return concatBytes(
    Uint8Array.of(0x31),
    textToBytes(lastAddress), Uint8Array.of(0),
    textToBytes(filter), Uint8Array.of(0),
  );
}

export function parseMasterServerBatch(data: Uint8Array): { nextAddress: string; servers: string[] } | null {
  if (data.length < 7) return null;
  const text = bytesToText(data.subarray(6));
  const parts = text.split('\0').filter(Boolean);
  const servers: string[] = [];
  for (const part of parts) {
    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(part)) servers.push(part);
  }
  return { nextAddress: servers[servers.length - 1] || '0.0.0.0:0', servers };
}

export function buildValveServerQuery(address: string): Uint8Array {
  return concatBytes(HEADER, Uint8Array.of(0x54), textToBytes('Source Engine Query\0'));
}

export function joinCommandForSteam(address: string): string {
  return `connect ${normalizeAddress(address)}`;
}

function normalizeAddress(address: string): string {
  return String(address || '').trim();
}

