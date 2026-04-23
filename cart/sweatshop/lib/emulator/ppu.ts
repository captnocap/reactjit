/**
 * PPU — NES Picture Processing Unit
 *
 * Scanline-based functional renderer. Per-pixel background + sprite lookup.
 * Not cycle-perfect on the fetch pipeline, but produces correct output for most games.
 */

import type { Cartridge } from './cartridge';

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;

// Standard NES NTSC palette (RGBA)
const NES_PALETTE: number[][] = [
  [0x80,0x80,0x80,0xFF], [0x00,0x3D,0xA6,0xFF], [0x00,0x12,0xB0,0xFF], [0x44,0x00,0x96,0xFF],
  [0xA1,0x00,0x5E,0xFF], [0xC7,0x00,0x28,0xFF], [0xBA,0x06,0x00,0xFF], [0x8C,0x17,0x00,0xFF],
  [0x5C,0x2F,0x00,0xFF], [0x10,0x45,0x00,0xFF], [0x05,0x4A,0x00,0xFF], [0x00,0x47,0x2E,0xFF],
  [0x00,0x41,0x66,0xFF], [0x00,0x00,0x00,0xFF], [0x05,0x05,0x05,0xFF], [0x05,0x05,0x05,0xFF],
  [0xC7,0xC7,0xC7,0xFF], [0x00,0x77,0xFF,0xFF], [0x21,0x55,0xFF,0xFF], [0x82,0x37,0xFA,0xFF],
  [0xEB,0x2F,0xB5,0xFF], [0xFF,0x29,0x50,0xFF], [0xFF,0x22,0x00,0xFF], [0xD6,0x32,0x00,0xFF],
  [0xC4,0x62,0x00,0xFF], [0x35,0x80,0x00,0xFF], [0x05,0x8F,0x00,0xFF], [0x00,0x8A,0x55,0xFF],
  [0x00,0x99,0xCC,0xFF], [0x21,0x21,0x21,0xFF], [0x09,0x09,0x09,0xFF], [0x09,0x09,0x09,0xFF],
  [0xFF,0xFF,0xFF,0xFF], [0x0F,0xD7,0xFF,0xFF], [0x69,0xA2,0xFF,0xFF], [0xD4,0x80,0xFF,0xFF],
  [0xFF,0x45,0xF3,0xFF], [0xFF,0x55,0x8B,0xFF], [0xFF,0x77,0x33,0xFF], [0xFF,0xB3,0x00,0xFF],
  [0xFA,0xD7,0x00,0xFF], [0x9F,0xE5,0x00,0xFF], [0x6A,0xD7,0x00,0xFF], [0x4B,0xD7,0x5E,0xFF],
  [0x38,0xD7,0xCC,0xFF], [0x4E,0x4E,0x4E,0xFF], [0x00,0x00,0x00,0xFF], [0x00,0x00,0x00,0xFF],
  [0xFF,0xFF,0xFF,0xFF], [0xA6,0xFC,0xFF,0xFF], [0xB3,0xEC,0xFF,0xFF], [0xDA,0xAB,0xEB,0xFF],
  [0xFF,0xA8,0xF9,0xFF], [0xFF,0xAB,0xB3,0xFF], [0xFF,0xD2,0xB0,0xFF], [0xFF,0xEF,0xA6,0xFF],
  [0xFF,0xF7,0x9C,0xFF], [0xD7,0xE8,0x95,0xFF], [0xA6,0xED,0xAF,0xFF], [0xA2,0xF2,0xDA,0xFF],
  [0x99,0xFF,0xFC,0xFF], [0xDD,0xDD,0xDD,0xFF], [0x11,0x11,0x11,0xFF], [0x11,0x11,0x11,0xFF],
];

export type MirrorMode = 'horizontal' | 'vertical' | 'single' | 'four';

export class PPU {
  cartridge: Cartridge;

  // Framebuffer: 256 * 240 * 4 (RGBA)
  framebuffer = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT * 4);

  // VRAM
  vram = new Uint8Array(2048);       // 2KB nametable RAM
  palette = new Uint8Array(32);      // 32 bytes palette RAM
  oam = new Uint8Array(256);         // 256 bytes OAM

  // Registers
  ctrl = 0;
  mask = 0;
  status = 0;
  oamAddr = 0;
  scroll = 0;
  addr = 0;
  data = 0;

  // Internal
  v = 0;      // 15-bit current VRAM address
  t = 0;      // 15-bit temporary VRAM address
  x = 0;      // 3-bit fine X scroll
  w = 0;      // 1-bit write toggle
  bufferedData = 0;

  // Timing
  cycle = 0;
  scanline = 0;
  frame = 0;

  // NMI
  nmiOccurred = false;
  nmiOutput = false;

  // Sprite cache for current scanline
  private scanlineSprites: Array<{ x: number; y: number; tile: number; attr: number; index: number }> = [];

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
  }

  reset(): void {
    this.ctrl = 0;
    this.mask = 0;
    this.status = 0;
    this.oamAddr = 0;
    this.scroll = 0;
    this.addr = 0;
    this.data = 0;
    this.v = 0;
    this.t = 0;
    this.x = 0;
    this.w = 0;
    this.bufferedData = 0;
    this.cycle = 0;
    this.scanline = 0;
    this.frame = 0;
    this.nmiOccurred = false;
    this.nmiOutput = false;
  }

  // ── Register access ─────────────────────────────────────────────

  readRegister(addr: number): number {
    switch (addr & 7) {
      case 2: {
        const result = (this.status & 0xE0) | (this.bufferedData & 0x1F);
        this.status &= ~0x80;
        this.nmiOccurred = false;
        this.w = 0;
        return result;
      }
      case 4: {
        return this.oam[this.oamAddr];
      }
      case 7: {
        let result = this.bufferedData;
        this.bufferedData = this.readVRAM(this.v & 0x3FFF);
        if ((this.v & 0x3FFF) >= 0x3F00) result = this.bufferedData;
        this.v += (this.ctrl & 0x04) ? 32 : 1;
        return result;
      }
      default:
        return 0;
    }
  }

  writeRegister(addr: number, value: number): void {
    switch (addr & 7) {
      case 0:
        this.ctrl = value;
        this.nmiOutput = (value & 0x80) !== 0;
        this.t = (this.t & 0xF3FF) | ((value & 0x03) << 10);
        break;
      case 1:
        this.mask = value;
        break;
      case 3:
        this.oamAddr = value;
        break;
      case 4:
        this.oam[this.oamAddr] = value;
        this.oamAddr = (this.oamAddr + 1) & 0xFF;
        break;
      case 5:
        if (this.w === 0) {
          this.t = (this.t & 0xFFE0) | (value >> 3);
          this.x = value & 0x07;
          this.w = 1;
        } else {
          this.t = (this.t & 0x8C1F) | ((value & 0x07) << 12) | ((value & 0xF8) << 2);
          this.w = 0;
        }
        break;
      case 6:
        if (this.w === 0) {
          this.t = (this.t & 0x00FF) | ((value & 0x3F) << 8);
          this.w = 1;
        } else {
          this.t = (this.t & 0xFF00) | value;
          this.v = this.t;
          this.w = 0;
        }
        break;
      case 7:
        this.writeVRAM(this.v & 0x3FFF, value);
        this.v += (this.ctrl & 0x04) ? 32 : 1;
        break;
    }
  }

  // ── VRAM access ─────────────────────────────────────────────────

  readVRAM(addr: number): number {
    addr = addr & 0x3FFF;
    if (addr < 0x2000) {
      return this.cartridge.readCHR(addr);
    } else if (addr < 0x3F00) {
      return this.vram[this.mirrorVRAMAddr(addr)];
    } else {
      return this.palette[this.paletteAddr(addr)];
    }
  }

  writeVRAM(addr: number, value: number): void {
    addr = addr & 0x3FFF;
    if (addr < 0x2000) {
      this.cartridge.writeCHR(addr, value);
    } else if (addr < 0x3F00) {
      this.vram[this.mirrorVRAMAddr(addr)] = value;
    } else {
      this.palette[this.paletteAddr(addr)] = value;
    }
  }

  mirrorVRAMAddr(addr: number): number {
    addr = (addr - 0x2000) & 0x0FFF;
    const mirror = this.cartridge.mirrorMode();
    if (mirror === 'vertical') {
      return addr & 0x07FF;
    } else if (mirror === 'horizontal') {
      return ((addr & 0x0800) >> 1) | (addr & 0x03FF);
    } else if (mirror === 'single') {
      return addr & 0x03FF;
    } else {
      return addr;
    }
  }

  paletteAddr(addr: number): number {
    addr = (addr - 0x3F00) & 0x1F;
    if (addr >= 0x10 && (addr & 0x03) === 0) addr -= 0x10;
    return addr;
  }

  // ── Background pixel ────────────────────────────────────────────

  getBackgroundPixel(px: number, py: number): number {
    if ((this.mask & 0x08) === 0) return 0;
    if ((this.mask & 0x02) === 0 && px < 8) return 0;

    // Compute effective scroll position from t register (base scroll)
    const coarseX = (this.t & 0x001F);
    const coarseY = (this.t & 0x03E0) >> 5;
    const fineY = (this.t & 0x7000) >> 12;
    const nameTable = (this.t & 0x0C00) >> 10;

    const effX = ((coarseX << 3) | this.x) + px;
    const effY = ((coarseY << 3) | fineY) + py;

    // Nametable wrapping
    const ntX = (nameTable & 1) + (effX >> 8);
    const ntY = (nameTable >> 1) + (effY >> 240 ? 1 : 0);
    const finalNT = ((ntY & 1) << 1) | (ntX & 1);

    const tileX = (effX >> 3) & 0x1F;
    const tileY = (effY >> 3) & 0x1F;
    const fy = effY & 0x07;

    // Nametable
    const ntAddr = 0x2000 | (finalNT << 10) | (tileY << 5) | tileX;
    const tileIndex = this.readVRAM(ntAddr);

    // Attribute
    const attrX = tileX >> 2;
    const attrY = tileY >> 2;
    const attrAddr = 0x2000 | (finalNT << 10) | 0x3C0 | (attrY << 3) | attrX;
    const attrByte = this.readVRAM(attrAddr);
    const shift = ((tileY & 0x02) << 1) | (tileX & 0x02);
    const paletteNum = (attrByte >> shift) & 0x03;

    // Pattern
    const patternTable = ((this.ctrl & 0x10) >> 4) << 12;
    const patternAddr = patternTable | (tileIndex << 4) | fy;
    const low = this.readVRAM(patternAddr);
    const high = this.readVRAM(patternAddr + 8);
    const bit = 7 - (effX & 0x07);
    const p0 = (low >> bit) & 1;
    const p1 = (high >> bit) & 1;
    const pixel = p0 | (p1 << 1);

    if (pixel === 0) return 0;
    return pixel + (paletteNum << 2);
  }

  // ── Sprite evaluation ───────────────────────────────────────────

  evaluateSprites(scanline: number): void {
    const spriteHeight = (this.ctrl & 0x20) ? 16 : 8;
    this.scanlineSprites = [];
    let count = 0;

    for (let i = 0; i < 64; i++) {
      const y = this.oam[i * 4];
      if (scanline < y || scanline >= y + spriteHeight) continue;
      if (count >= 8) {
        this.status |= 0x20;
        break;
      }
      this.scanlineSprites.push({
        x: this.oam[i * 4 + 3],
        y,
        tile: this.oam[i * 4 + 1],
        attr: this.oam[i * 4 + 2],
        index: i,
      });
      count++;
    }
  }

  getSpritePixel(px: number, py: number): { pixel: number; palette: number; priority: number; index: number } | null {
    if ((this.mask & 0x10) === 0) return null;
    if ((this.mask & 0x04) === 0 && px < 8) return null;

    const spriteHeight = (this.ctrl & 0x20) ? 16 : 8;

    for (const spr of this.scanlineSprites) {
      if (px < spr.x || px >= spr.x + 8) continue;

      let row = py - spr.y;
      let col = px - spr.x;

      if (spr.attr & 0x80) row = spriteHeight - 1 - row; // vertical flip
      if (spr.attr & 0x40) col = 7 - col; // horizontal flip

      let tileAddr: number;
      if (spriteHeight === 16) {
        const bank = (spr.tile & 0x01) << 12;
        const tile = spr.tile & 0xFE;
        if (row > 7) {
          tileAddr = bank | ((tile + 1) << 4) | (row & 0x07);
        } else {
          tileAddr = bank | (tile << 4) | row;
        }
      } else {
        const bank = ((this.ctrl & 0x08) >> 3) << 12;
        tileAddr = bank | (spr.tile << 4) | row;
      }

      const low = this.readVRAM(tileAddr);
      const high = this.readVRAM(tileAddr + 8);
      const bit = 7 - col;
      const p0 = (low >> bit) & 1;
      const p1 = (high >> bit) & 1;
      const pixel = p0 | (p1 << 1);

      if (pixel === 0) continue;
      return {
        pixel,
        palette: ((spr.attr & 0x03) << 2) | 0x10,
        priority: (spr.attr >> 5) & 1,
        index: spr.index,
      };
    }

    return null;
  }

  // ── Render scanline ─────────────────────────────────────────────

  renderScanline(y: number): void {
    this.evaluateSprites(y);

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const bg = this.getBackgroundPixel(x, y);
      const spr = this.getSpritePixel(x, y);

      let colorAddr = 0;
      let sprite0Hit = false;

      if (bg === 0 && !spr) {
        colorAddr = 0x3F00;
      } else if (bg === 0 && spr) {
        colorAddr = 0x3F10 | spr.palette | spr.pixel;
      } else if (bg !== 0 && !spr) {
        colorAddr = 0x3F00 | bg;
      } else {
        // Both
        if (spr!.priority === 0) {
          colorAddr = 0x3F10 | spr!.palette | spr!.pixel;
        } else {
          colorAddr = 0x3F00 | bg;
        }
        if (spr!.index === 0 && x < 255 && bg !== 0) {
          sprite0Hit = true;
        }
      }

      if (sprite0Hit) {
        this.status |= 0x40;
      }

      const colorIdx = this.readVRAM(colorAddr) & 0x3F;
      const rgb = NES_PALETTE[colorIdx];
      const idx = (y * SCREEN_WIDTH + x) * 4;
      this.framebuffer[idx] = rgb[0];
      this.framebuffer[idx + 1] = rgb[1];
      this.framebuffer[idx + 2] = rgb[2];
      this.framebuffer[idx + 3] = rgb[3];
    }
  }

  // ── Step ────────────────────────────────────────────────────────

  step(cycles: number): boolean {
    let newFrame = false;
    const ppuCycles = cycles * 3;

    for (let i = 0; i < ppuCycles; i++) {
      this.cycle++;
      if (this.cycle > 340) {
        this.cycle = 0;
        this.scanline++;

        if (this.scanline === 241) {
          // VBlank start
          this.status |= 0x80;
          this.nmiOccurred = true;
        } else if (this.scanline === 261) {
          // Pre-render scanline
          this.scanline = -1;
          this.frame++;
          this.status &= ~0x80;
          this.status &= ~0x40;
          this.status &= ~0x20;
          this.nmiOccurred = false;
          newFrame = true;
        }
      }

      // Render visible scanlines
      if (this.scanline >= 0 && this.scanline < 240 && this.cycle === 256) {
        this.renderScanline(this.scanline);
      }
    }

    return newFrame;
  }

  pollNMI(): boolean {
    if (this.nmiOccurred && this.nmiOutput) {
      this.nmiOccurred = false;
      return true;
    }
    return false;
  }
}
