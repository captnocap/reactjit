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

function cString(value: string): Uint8Array {
  return concatBytes(textToBytes(value), Uint8Array.of(0));
}

export type ValveServerInfo = {
  protocol: number;
  name: string;
  map: string;
  folder: string;
  game: string;
  appId: number;
  players: number;
  maxPlayers: number;
  bots: number;
  serverType: string;
  environment: string;
  visibility: number;
  vac: number;
  version: string;
};

export type ValvePlayer = { id: number; name: string; score: number; duration: number; };

function readByte(data: Uint8Array, pos: number): [number, number] {
  return pos < data.length ? [data[pos], pos + 1] : [0, pos];
}

function readShort(data: Uint8Array, pos: number): [number, number] {
  if (pos + 1 >= data.length) return [0, pos];
  return [data[pos] + data[pos + 1] * 256, pos + 2];
}

function readLong(data: Uint8Array, pos: number): [number, number] {
  if (pos + 3 >= data.length) return [0, pos];
  return [data[pos] + data[pos + 1] * 256 + data[pos + 2] * 65536 + data[pos + 3] * 16777216, pos + 4];
}

function readFloat(data: Uint8Array, pos: number): [number, number] {
  const view = new DataView(data.buffer, data.byteOffset + pos, 4);
  return [view.getFloat32(0, true), pos + 4];
}

function readString(data: Uint8Array, pos: number): [string, number] {
  let end = pos;
  while (end < data.length && data[end] !== 0) end++;
  return [bytesToText(data.subarray(pos, end)), end + 1];
}

export function buildA2SInfoRequest(): Uint8Array {
  return concatBytes(HEADER, textToBytes('TSource Engine Query\0'));
}

export function buildA2SPlayersRequest(challenge = 0xffffffff): Uint8Array {
  const payload = new Uint8Array(5);
  payload[0] = 0x55;
  const view = new DataView(payload.buffer);
  view.setUint32(1, challenge >>> 0, true);
  return concatBytes(HEADER, payload);
}

export function buildA2SRulesRequest(challenge = 0xffffffff): Uint8Array {
  const payload = new Uint8Array(5);
  payload[0] = 0x56;
  const view = new DataView(payload.buffer);
  view.setUint32(1, challenge >>> 0, true);
  return concatBytes(HEADER, payload);
}

export function parseA2SInfo(data: Uint8Array): ValveServerInfo | null {
  if (data.length < 6 || data[4] !== 0x49 && data[4] !== 0x6d) return null;
  let pos = 6;
  const typeByte = data[4];
  if (typeByte === 0x6d) {
    const info: any = {};
    [info.address, pos] = readString(data, pos);
    [info.name, pos] = readString(data, pos);
    [info.map, pos] = readString(data, pos);
    [info.folder, pos] = readString(data, pos);
    [info.game, pos] = readString(data, pos);
    [info.players, pos] = readByte(data, pos);
    [info.maxPlayers, pos] = readByte(data, pos);
    [info.protocol, pos] = readByte(data, pos);
    return info as ValveServerInfo;
  }
  const info: any = {};
  [info.protocol, pos] = readByte(data, pos);
  [info.name, pos] = readString(data, pos);
  [info.map, pos] = readString(data, pos);
  [info.folder, pos] = readString(data, pos);
  [info.game, pos] = readString(data, pos);
  [info.appId, pos] = readShort(data, pos);
  [info.players, pos] = readByte(data, pos);
  [info.maxPlayers, pos] = readByte(data, pos);
  [info.bots, pos] = readByte(data, pos);
  [info.serverType, pos] = readByte(data, pos);
  [info.environment, pos] = readByte(data, pos);
  [info.visibility, pos] = readByte(data, pos);
  [info.vac, pos] = readByte(data, pos);
  [info.version, pos] = readString(data, pos);
  return info as ValveServerInfo;
}

export function parseA2SPlayers(data: Uint8Array): ValvePlayer[] {
  if (data.length < 6 || data[4] !== 0x44) return [];
  let pos = 6;
  let count = 0;
  [count, pos] = readByte(data, pos);
  const players: ValvePlayer[] = [];
  for (let i = 0; i < count; i++) {
    const player: any = {};
    [player.id, pos] = readByte(data, pos);
    [player.name, pos] = readString(data, pos);
    [player.score, pos] = readLong(data, pos);
    [player.duration, pos] = readFloat(data, pos);
    players.push(player as ValvePlayer);
  }
  return players;
}

export function parseA2SRules(data: Uint8Array): Record<string, string> {
  if (data.length < 6 || data[4] !== 0x45) return {};
  let pos = 6;
  let count = 0;
  [count, pos] = readShort(data, pos);
  const rules: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    let key = '';
    let value = '';
    [key, pos] = readString(data, pos);
    [value, pos] = readString(data, pos);
    rules[key] = value;
  }
  return rules;
}

export function joinCommandForValve(address: string): string {
  return `connect ${normalizeAddress(address)}`;
}

function normalizeAddress(address: string): string {
  return String(address || '').trim();
}

