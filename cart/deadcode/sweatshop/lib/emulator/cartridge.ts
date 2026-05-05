/**
 * Cartridge — iNES / NES2.0 ROM parser + mappers
 *
 * Supports: NROM (mapper 0), MMC1 (mapper 1), UxROM (mapper 2), CNROM (mapper 3).
 * TODO: MMC3 (mapper 4), etc.
 */

import type { MirrorMode } from './ppu';
import { MapperUxROM } from './mappers/uxrom';
import { MapperCNROM } from './mappers/cnrom';

export interface Mapper {
  readPRG(addr: number): number;
  writePRG(addr: number, value: number): void;
  readCHR(addr: number): number;
  writeCHR(addr: number, value: number): void;
  mirror(): MirrorMode;
}

export class Cartridge {
  prgROM: Uint8Array;
  chrROM: Uint8Array;
  prgRAM: Uint8Array;
  mapper: Mapper;

  constructor(prgROM: Uint8Array, chrROM: Uint8Array, mapper: Mapper, prgRAMSize: number = 0x2000) {
    this.prgROM = prgROM;
    this.chrROM = chrROM;
    this.prgRAM = new Uint8Array(prgRAMSize);
    this.mapper = mapper;
  }

  readPRG(addr: number): number {
    return this.mapper.readPRG(addr);
  }

  writePRG(addr: number, value: number): void {
    this.mapper.writePRG(addr, value);
  }

  readCHR(addr: number): number {
    return this.mapper.readCHR(addr);
  }

  writeCHR(addr: number, value: number): void {
    this.mapper.writeCHR(addr, value);
  }

  mirrorMode(): MirrorMode {
    return this.mapper.mirror();
  }

  static loadINES(data: Uint8Array): Cartridge | null {
    if (data.length < 16) return null;
    if (data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53 || data[3] !== 0x1A) {
      return null;
    }

    const prgSize = data[4] * 16384;
    const chrSize = data[5] * 8192;
    const flags6 = data[6];
    const flags7 = data[7];
    const flags8 = data[8];
    const flags9 = data[9];

    const mapperNumber = ((flags7 & 0xF0) | ((flags6 & 0xF0) >> 4));
    const nes20 = (flags7 & 0x0C) === 0x08;
    const trainer = (flags6 & 0x04) !== 0;

    let mirror: MirrorMode = (flags6 & 0x01) ? 'vertical' : 'horizontal';
    if (flags6 & 0x08) mirror = 'four';

    let offset = 16;
    if (trainer) offset += 512;

    const prgROM = data.slice(offset, offset + prgSize);
    offset += prgSize;
    const chrROM = chrSize > 0 ? data.slice(offset, offset + chrSize) : new Uint8Array(8192);

    const prgRAMSize = flags8 > 0 ? flags8 * 8192 : 0x2000;

    if (nes20) {
      // NES2.0 extended mapper number
      const mapperHi = ((data[8] & 0x0F) << 8);
      const fullMapper = mapperNumber | mapperHi;
      // TODO: NES2.0 submappers, PRG-RAM sizes from header bytes 10-11
      return Cartridge.createMapper(fullMapper, prgROM, chrROM, mirror, prgRAMSize);
    }

    return Cartridge.createMapper(mapperNumber, prgROM, chrROM, mirror, prgRAMSize);
  }

  static createMapper(number: number, prgROM: Uint8Array, chrROM: Uint8Array, mirror: MirrorMode, prgRAMSize: number): Cartridge | null {
    switch (number) {
      case 0:
        return new Cartridge(prgROM, chrROM, new MapperNROM(prgROM, chrROM, mirror), prgRAMSize);
      case 1:
        return new Cartridge(prgROM, chrROM, new MapperMMC1(prgROM, chrROM, mirror), prgRAMSize);
      case 2:
        return new Cartridge(prgROM, chrROM, new MapperUxROM(prgROM, chrROM, mirror), prgRAMSize);
      case 3:
        return new Cartridge(prgROM, chrROM, new MapperCNROM(prgROM, chrROM, mirror), prgRAMSize);
      default:
        console.warn(`[emulator] Unsupported mapper: ${number}. Falling back to NROM (game may not work).`);
        return new Cartridge(prgROM, chrROM, new MapperNROM(prgROM, chrROM, mirror), prgRAMSize);
    }
  }
}

// ── Mapper 0: NROM ──────────────────────────────────────────────

class MapperNROM implements Mapper {
  prgROM: Uint8Array;
  chrROM: Uint8Array;
  chrRAM: Uint8Array;
  mirrorMode: MirrorMode;

  constructor(prgROM: Uint8Array, chrROM: Uint8Array, mirror: MirrorMode) {
    this.prgROM = prgROM;
    this.chrROM = chrROM;
    this.chrRAM = new Uint8Array(8192);
    this.mirrorMode = mirror;
  }

  readPRG(addr: number): number {
    addr = addr & 0x7FFF;
    if (this.prgROM.length === 0x4000) {
      return this.prgROM[addr & 0x3FFF];
    }
    return this.prgROM[addr % this.prgROM.length];
  }

  writePRG(_addr: number, _value: number): void {
    // NROM is ROM only (no PRG-RAM writes to mapper)
  }

  readCHR(addr: number): number {
    if (this.chrROM.length > 0) {
      return this.chrROM[addr % this.chrROM.length];
    }
    return this.chrRAM[addr & 0x1FFF];
  }

  writeCHR(addr: number, value: number): void {
    if (this.chrROM.length === 0) {
      this.chrRAM[addr & 0x1FFF] = value;
    }
  }

  mirror(): MirrorMode {
    return this.mirrorMode;
  }
}

// ── Mapper 1: MMC1 ──────────────────────────────────────────────

class MapperMMC1 implements Mapper {
  prgROM: Uint8Array;
  chrROM: Uint8Array;
  chrRAM: Uint8Array;
  prgRAM: Uint8Array;
  mirrorMode: MirrorMode;

  shiftRegister = 0x10;
  control = 0x0C;
  chrBank0 = 0;
  chrBank1 = 0;
  prgBank = 0;

  constructor(prgROM: Uint8Array, chrROM: Uint8Array, mirror: MirrorMode, prgRAMSize: number = 0x2000) {
    this.prgROM = prgROM;
    this.chrROM = chrROM;
    this.chrRAM = new Uint8Array(8192);
    this.prgRAM = new Uint8Array(prgRAMSize);
    this.mirrorMode = mirror;
  }

  readPRG(addr: number): number {
    addr = addr & 0x7FFF;
    const mode = (this.control >> 2) & 0x03;
    const bank = this.prgBank & 0x0F;
    const banks = this.prgROM.length / 0x4000;

    if (mode <= 1) {
      // 32KB mode
      const b = (bank >> 1) % (banks >> 1);
      return this.prgROM[(b * 0x8000 + addr) % this.prgROM.length];
    } else if (mode === 2) {
      // fix first bank at $8000
      if (addr < 0x4000) return this.prgROM[addr];
      return this.prgROM[((bank % banks) * 0x4000 + (addr & 0x3FFF)) % this.prgROM.length];
    } else {
      // fix last bank at $C000
      if (addr >= 0x4000) return this.prgROM[this.prgROM.length - 0x4000 + (addr & 0x3FFF)];
      return this.prgROM[((bank % banks) * 0x4000 + addr) % this.prgROM.length];
    }
  }

  writePRG(addr: number, value: number): void {
    addr = addr & 0x7FFF;
    if (value & 0x80) {
      this.shiftRegister = 0x10;
      this.control |= 0x0C;
      return;
    }
    const bit = value & 1;
    this.shiftRegister = (this.shiftRegister >> 1) | (bit << 4);
    if (this.shiftRegister & 1) {
      const reg = (addr >> 13) & 0x03;
      const data = this.shiftRegister >> 1;
      switch (reg) {
        case 0:
          this.control = data;
          switch (data & 0x03) {
            case 0: this.mirrorMode = 'single'; break;
            case 1: this.mirrorMode = 'single'; break;
            case 2: this.mirrorMode = 'vertical'; break;
            case 3: this.mirrorMode = 'horizontal'; break;
          }
          break;
        case 1:
          this.chrBank0 = data;
          break;
        case 2:
          this.chrBank1 = data;
          break;
        case 3:
          this.prgBank = data;
          break;
      }
      this.shiftRegister = 0x10;
    }
  }

  readCHR(addr: number): number {
    addr = addr & 0x1FFF;
    const mode = (this.control >> 4) & 1;
    const chrBanks = Math.max(1, this.chrROM.length / 0x1000);

    if (mode === 0) {
      // 8KB mode
      const bank = (this.chrBank0 >> 1) % (chrBanks >> 1);
      return this.chrROM[(bank * 0x2000 + addr) % this.chrROM.length];
    } else {
      // 4KB mode
      if (addr < 0x1000) {
        return this.chrROM[((this.chrBank0 % chrBanks) * 0x1000 + addr) % this.chrROM.length];
      } else {
        return this.chrROM[((this.chrBank1 % chrBanks) * 0x1000 + (addr & 0x0FFF)) % this.chrROM.length];
      }
    }
  }

  writeCHR(addr: number, value: number): void {
    if (this.chrROM.length === 0) {
      this.chrRAM[addr & 0x1FFF] = value;
    }
  }

  mirror(): MirrorMode {
    return this.mirrorMode;
  }
}
