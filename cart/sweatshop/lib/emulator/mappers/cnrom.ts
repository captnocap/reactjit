import type { Mapper } from '../cartridge';
import type { MirrorMode } from '../ppu';

export class MapperCNROM implements Mapper {
  prgROM: Uint8Array;
  chrROM: Uint8Array;
  chrRAM: Uint8Array;
  mirrorMode: MirrorMode;
  chrBank = 0;

  constructor(prgROM: Uint8Array, chrROM: Uint8Array, mirror: MirrorMode) {
    this.prgROM = prgROM;
    this.chrROM = chrROM;
    this.chrRAM = chrROM.length === 0 ? new Uint8Array(8192) : new Uint8Array(0);
    this.mirrorMode = mirror;
  }

  readPRG(addr: number): number {
    addr &= 0x7FFF;
    return this.prgROM[addr % this.prgROM.length];
  }

  writePRG(addr: number, value: number): void {
    if (addr >= 0x8000) {
      this.chrBank = value & 0x03;
    }
  }

  readCHR(addr: number): number {
    addr &= 0x1FFF;
    if (this.chrROM.length > 0) {
      const bank = this.chrBank % Math.max(1, this.chrROM.length / 0x2000);
      return this.chrROM[(bank * 0x2000 + addr) % this.chrROM.length];
    }
    return this.chrRAM[addr];
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
