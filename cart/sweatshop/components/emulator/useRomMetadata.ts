// iNES header parser + CRC32 over PRG+CHR. The library stores the CRC so
// the same physical ROM on two different paths is recognised as one
// entry, and so the bundled known-games table (if present) can be
// consulted. No online lookups — everything runs against bytes the user
// already loaded.

export type RomMetadata = {
  valid: boolean;
  format: 'iNES' | 'NES2.0' | 'invalid';
  prgSize: number;       // bytes
  chrSize: number;       // bytes; 0 means CHR-RAM
  mapperId: number;
  mirroring: 'horizontal' | 'vertical' | 'four-screen';
  hasBattery: boolean;
  hasTrainer: boolean;
  prgRamSize: number;    // best-effort from NES2.0, else default
  crc32: string;         // 8 hex chars, uppercase, prefix-less
  headerHint?: string;   // post-header "DiskDude!"-style garbage stripped if present
};

const CRC_TABLE: number[] = (() => {
  const t: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): string {
  let c = 0xFFFFFFFF >>> 0;
  for (let i = 0; i < bytes.length; i++) c = (CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  const val = (c ^ 0xFFFFFFFF) >>> 0;
  return val.toString(16).padStart(8, '0').toUpperCase();
}

export function parseInesHeader(data: Uint8Array): RomMetadata {
  const bad: RomMetadata = {
    valid: false, format: 'invalid', prgSize: 0, chrSize: 0,
    mapperId: 0, mirroring: 'horizontal',
    hasBattery: false, hasTrainer: false, prgRamSize: 0x2000,
    crc32: '',
  };
  if (data.length < 16) return bad;
  if (data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53 || data[3] !== 0x1A) return bad;

  const prgSize = data[4] * 16384;
  const chrSize = data[5] * 8192;
  const f6 = data[6];
  const f7 = data[7];
  const mapperId = (f7 & 0xF0) | (f6 >> 4);
  const mirroring: RomMetadata['mirroring'] = (f6 & 0x08) ? 'four-screen' : (f6 & 0x01) ? 'vertical' : 'horizontal';
  const hasBattery = (f6 & 0x02) !== 0;
  const hasTrainer = (f6 & 0x04) !== 0;
  const isNes2 = (f7 & 0x0C) === 0x08;

  // CRC over the program + char data only — matches the de facto GoodNES
  // convention, so headers / trainer padding don't influence identity.
  const headerOff = 16 + (hasTrainer ? 512 : 0);
  const prgChr = data.subarray(headerOff, headerOff + prgSize + chrSize);
  const checksum = crc32(prgChr);

  return {
    valid: true,
    format: isNes2 ? 'NES2.0' : 'iNES',
    prgSize, chrSize,
    mapperId, mirroring,
    hasBattery, hasTrainer,
    prgRamSize: 0x2000,
    crc32: checksum,
  };
}

// Known-games lookup: bundled JSON at build time under
// `cart/sweatshop/lib/emulator/known_games.json`. Missing file is fine —
// caller falls back to the filename as the display name. We don't embed
// any copyrighted titles here; the table ships empty.
let _known: Record<string, { title: string; region?: string; year?: number }> | null = null;

export function lookupKnownByCrc(crc: string): { title: string; region?: string; year?: number } | null {
  if (_known === null) {
    _known = {};
    try {
      // Optional bundled table. Kept as a separate JSON so users or
      // plugins can extend it without touching ambient ts.
      _known = require('../../lib/emulator/known_games.json') || {};
    } catch (_e) {
      _known = {};
    }
  }
  return _known![crc] || null;
}
