/**
 * Bus — NES system bus connecting CPU, PPU, APU, Cartridge, Input
 */

import { CPU6502 } from './cpu6502';
import { PPU } from './ppu';
import { APU } from './apu';
import { Cartridge } from './cartridge';
import { Controller } from './input';

export class Bus {
  cpu: CPU6502;
  ppu: PPU;
  apu: APU;
  cartridge: Cartridge;
  controller1: Controller;
  controller2: Controller;

  // Internal RAM: 2KB
  ram = new Uint8Array(2048);

  // DMA
  dmaPage = 0;
  dmaAddr = 0;
  dmaData = 0;
  dmaTransfer = false;
  dmaDummy = true;

  // System cycles
  systemClockCounter = 0;

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
    this.ppu = new PPU(cartridge);
    this.apu = new APU();
    this.controller1 = new Controller();
    this.controller2 = new Controller();
    this.cpu = new CPU6502({
      read: (addr: number) => this.cpuRead(addr),
      write: (addr: number, value: number) => this.cpuWrite(addr, value),
    });
  }

  reset(): void {
    this.ram.fill(0);
    this.dmaPage = 0;
    this.dmaAddr = 0;
    this.dmaData = 0;
    this.dmaTransfer = false;
    this.dmaDummy = true;
    this.systemClockCounter = 0;
    this.cpu.reset();
    this.ppu.reset();
    this.apu.reset();
  }

  cpuRead(addr: number, readOnly = false): number {
    addr = addr & 0xFFFF;
    let data = 0;

    if (this.cartridge && addr >= 0x4020) {
      data = this.cartridge.readPRG(addr);
    } else if (addr < 0x2000) {
      data = this.ram[addr & 0x07FF];
    } else if (addr >= 0x2000 && addr <= 0x3FFF) {
      data = this.ppu.readRegister(addr & 0x0007);
    } else if (addr === 0x4014) {
      data = this.dmaPage;
    } else if (addr === 0x4015) {
      data = this.apu.readRegister(addr);
    } else if (addr === 0x4016) {
      data = this.controller1.read();
    } else if (addr === 0x4017) {
      data = this.controller2.read();
    }

    return data;
  }

  cpuWrite(addr: number, value: number): void {
    addr = addr & 0xFFFF;
    value = value & 0xFF;

    if (this.cartridge && addr >= 0x4020) {
      this.cartridge.writePRG(addr, value);
    } else if (addr < 0x2000) {
      this.ram[addr & 0x07FF] = value;
    } else if (addr >= 0x2000 && addr <= 0x3FFF) {
      this.ppu.writeRegister(addr & 0x0007, value);
    } else if (addr === 0x4014) {
      this.dmaPage = value;
      this.dmaAddr = 0;
      this.dmaTransfer = true;
    } else if (addr === 0x4015) {
      this.apu.writeRegister(addr, value);
    } else if (addr === 0x4016) {
      this.controller1.write(value);
      this.controller2.write(value);
    } else if (addr === 0x4017) {
      this.apu.writeRegister(addr, value);
    }
  }

  // ── Clock ───────────────────────────────────────────────────────

  clock(): boolean {
    let newFrame = false;

    newFrame = this.ppu.step(1) || newFrame;

    if (this.systemClockCounter % 3 === 0) {
      if (this.dmaTransfer) {
        if (this.dmaDummy) {
          if (this.systemClockCounter % 2 === 1) {
            this.dmaDummy = false;
          }
        } else {
          if (this.systemClockCounter % 2 === 0) {
            this.dmaData = this.cpuRead((this.dmaPage << 8) | this.dmaAddr);
          } else {
            this.ppu.oam[this.ppu.oamAddr] = this.dmaData;
            this.ppu.oamAddr = (this.ppu.oamAddr + 1) & 0xFF;
            this.dmaAddr++;
            if (this.dmaAddr === 0x100) {
              this.dmaTransfer = false;
              this.dmaDummy = true;
            }
          }
        }
      } else {
        this.cpu.step();
      }
    }

    if (this.ppu.pollNMI()) {
      this.cpu.nmi();
    }

    this.systemClockCounter++;
    return newFrame;
  }
}
