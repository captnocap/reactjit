import type { Mapper } from '../cartridge';
import type { MirrorMode } from '../ppu';

export class MapperUxROM implements Mapper {
  prgROM: Uint8Array;
  chrRAM: Uint8Array;
  mirrorMode: MirrorMode;
  bankSelect = 0;

  constructor(prgROM: Uint8Array, chrROM: Uint8Array, mirror: MirrorMode) {
    this.prgROM = prgROM;
    this.chrRAM = chrROM.length > 0 ? chrROM : new Uint8Array(8192);
    this.mirrorMode = mirror;
  }

  readPRG(addr: number): number {
    addr &= 0x7FFF;
    const banks = Math.max(1, this.prgROM.length / 0x4000);
    if (addr < 0x4000) {
      const bank = this.bankSelect % banks;
      return this.prgROM[(bank * 0x4000 + addr) % this.prgROM.length];
    }
    return this.prgROM[this.prgROM.length - 0x4000 + (addr & 0x3FFF)];
  }

  writePRG(addr: number, value: number): void {
    if (addr >= 0x8000) {
      this.bankSelect = value & 0x0F;
    }
  }

  readCHR(addr: number): number {
    return this.chrRAM[addr & 0x1FFF];
  }

  writeCHR(addr: number, value: number): void {
    this.chrRAM[addr & 0x1FFF] = value;
  }

  mirror(): MirrorMode {
    return this.mirrorMode;
  }
}
