/**
 * CPU6502 — MOS Technology 6502 CPU emulator
 *
 * Implements all documented opcodes + addressing modes.
 * Cycle counts are approximate (no exact page-cross penalty tracking for all ops).
 */

export interface Bus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

// Status flag bits
const FLAG_N = 0x80;
const FLAG_V = 0x40;
const FLAG_U = 0x20; // always set
const FLAG_B = 0x10;
const FLAG_D = 0x08;
const FLAG_I = 0x04;
const FLAG_Z = 0x02;
const FLAG_C = 0x01;

export class CPU6502 {
  bus: Bus;

  // Registers
  a = 0;
  x = 0;
  y = 0;
  sp = 0xFD;
  pc = 0;
  status = FLAG_U | FLAG_I; // startup: I=1, U=1

  cycles = 0;

  // Internal
  fetched = 0;
  addrAbs = 0;
  addrRel = 0;
  opcode = 0;
  clockCount = 0;

  constructor(bus: Bus) {
    this.bus = bus;
  }

  reset(): void {
    this.addrAbs = 0xFFFC;
    const lo = this.bus.read(this.addrAbs);
    const hi = this.bus.read(this.addrAbs + 1);
    this.pc = (hi << 8) | lo;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xFD;
    this.status = FLAG_U | FLAG_I;
    this.addrAbs = 0;
    this.addrRel = 0;
    this.fetched = 0;
    this.cycles = 8;
  }

  // ── Status helpers ──────────────────────────────────────────────

  getFlag(f: number): number {
    return (this.status & f) ? 1 : 0;
  }

  setFlag(f: number, v: boolean): void {
    if (v) this.status |= f;
    else this.status &= ~f;
  }

  // ── Stack ───────────────────────────────────────────────────────

  stackPush(v: number): void {
    this.bus.write(0x0100 + this.sp, v & 0xFF);
    this.sp = (this.sp - 1) & 0xFF;
  }

  stackPop(): number {
    this.sp = (this.sp + 1) & 0xFF;
    return this.bus.read(0x0100 + this.sp);
  }

  // ── Fetch ───────────────────────────────────────────────────────

  fetch(): number {
    if (!(this.lookup[this.opcode].mode === this.IMP)) {
      this.fetched = this.bus.read(this.addrAbs);
    }
    return this.fetched;
  }

  // ── Addressing modes ────────────────────────────────────────────

  IMP = (): number => {
    this.fetched = this.a;
    return 0;
  };

  IMM = (): number => {
    this.addrAbs = this.pc++;
    return 0;
  };

  ZP0 = (): number => {
    this.addrAbs = this.bus.read(this.pc++);
    this.addrAbs &= 0x00FF;
    return 0;
  };

  ZPX = (): number => {
    this.addrAbs = (this.bus.read(this.pc++) + this.x) & 0xFF;
    return 0;
  };

  ZPY = (): number => {
    this.addrAbs = (this.bus.read(this.pc++) + this.y) & 0xFF;
    return 0;
  };

  REL = (): number => {
    this.addrRel = this.bus.read(this.pc++);
    if (this.addrRel & 0x80) this.addrRel |= 0xFF00;
    return 0;
  };

  ABS = (): number => {
    const lo = this.bus.read(this.pc++);
    const hi = this.bus.read(this.pc++);
    this.addrAbs = (hi << 8) | lo;
    return 0;
  };

  ABX = (): number => {
    const lo = this.bus.read(this.pc++);
    const hi = this.bus.read(this.pc++);
    this.addrAbs = ((hi << 8) | lo) + this.x;
    if ((this.addrAbs & 0xFF00) !== (hi << 8)) return 1;
    return 0;
  };

  ABY = (): number => {
    const lo = this.bus.read(this.pc++);
    const hi = this.bus.read(this.pc++);
    this.addrAbs = ((hi << 8) | lo) + this.y;
    if ((this.addrAbs & 0xFF00) !== (hi << 8)) return 1;
    return 0;
  };

  IND = (): number => {
    const ptrLo = this.bus.read(this.pc++);
    const ptrHi = this.bus.read(this.pc++);
    const ptr = (ptrHi << 8) | ptrLo;
    if (ptrLo === 0x00FF) {
      this.addrAbs = (this.bus.read(ptr & 0xFF00) << 8) | this.bus.read(ptr);
    } else {
      this.addrAbs = (this.bus.read(ptr + 1) << 8) | this.bus.read(ptr);
    }
    return 0;
  };

  IZX = (): number => {
    const t = this.bus.read(this.pc++);
    const lo = this.bus.read((t + this.x) & 0xFF);
    const hi = this.bus.read((t + this.x + 1) & 0xFF);
    this.addrAbs = (hi << 8) | lo;
    return 0;
  };

  IZY = (): number => {
    const t = this.bus.read(this.pc++);
    const lo = this.bus.read(t & 0xFF);
    const hi = this.bus.read((t + 1) & 0xFF);
    this.addrAbs = ((hi << 8) | lo) + this.y;
    if ((this.addrAbs & 0xFF00) !== (hi << 8)) return 1;
    return 0;
  };

  // ── Instructions ────────────────────────────────────────────────

  ADC = (): number => {
    this.fetch();
    const temp = this.a + this.fetched + this.getFlag(FLAG_C);
    this.setFlag(FLAG_C, temp > 0xFF);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_V, (~(this.a ^ this.fetched) & (this.a ^ temp) & 0x80) !== 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    this.a = temp & 0xFF;
    return 1;
  };

  AND = (): number => {
    this.fetch();
    this.a &= this.fetched;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 1;
  };

  ASL = (): number => {
    this.fetch();
    const temp = this.fetched << 1;
    this.setFlag(FLAG_C, (temp & 0xFF00) !== 0);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    if (this.lookup[this.opcode].mode === this.IMP) {
      this.a = temp & 0xFF;
    } else {
      this.bus.write(this.addrAbs, temp & 0xFF);
    }
    return 0;
  };

  BCC = (): number => {
    if (this.getFlag(FLAG_C) === 0) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BCS = (): number => {
    if (this.getFlag(FLAG_C) === 1) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BEQ = (): number => {
    if (this.getFlag(FLAG_Z) === 1) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BIT = (): number => {
    this.fetch();
    const temp = this.a & this.fetched;
    this.setFlag(FLAG_Z, temp === 0);
    this.setFlag(FLAG_N, (this.fetched & 0x80) !== 0);
    this.setFlag(FLAG_V, (this.fetched & 0x40) !== 0);
    return 0;
  };

  BMI = (): number => {
    if (this.getFlag(FLAG_N) === 1) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BNE = (): number => {
    if (this.getFlag(FLAG_Z) === 0) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BPL = (): number => {
    if (this.getFlag(FLAG_N) === 0) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BRK = (): number => {
    this.pc++;
    this.setFlag(FLAG_I, true);
    this.stackPush((this.pc >> 8) & 0xFF);
    this.stackPush(this.pc & 0xFF);
    this.setFlag(FLAG_B, true);
    this.stackPush(this.status);
    this.setFlag(FLAG_B, false);
    this.pc = (this.bus.read(0xFFFE) | (this.bus.read(0xFFFF) << 8));
    return 0;
  };

  BVC = (): number => {
    if (this.getFlag(FLAG_V) === 0) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  BVS = (): number => {
    if (this.getFlag(FLAG_V) === 1) {
      this.cycles++;
      this.addrAbs = this.pc + this.addrRel;
      if ((this.addrAbs & 0xFF00) !== (this.pc & 0xFF00)) this.cycles++;
      this.pc = this.addrAbs;
    }
    return 0;
  };

  CLC = (): number => {
    this.setFlag(FLAG_C, false);
    return 0;
  };

  CLD = (): number => {
    this.setFlag(FLAG_D, false);
    return 0;
  };

  CLI = (): number => {
    this.setFlag(FLAG_I, false);
    return 0;
  };

  CLV = (): number => {
    this.setFlag(FLAG_V, false);
    return 0;
  };

  CMP = (): number => {
    this.fetch();
    const temp = this.a - this.fetched;
    this.setFlag(FLAG_C, this.a >= this.fetched);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    return 1;
  };

  CPX = (): number => {
    this.fetch();
    const temp = this.x - this.fetched;
    this.setFlag(FLAG_C, this.x >= this.fetched);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    return 0;
  };

  CPY = (): number => {
    this.fetch();
    const temp = this.y - this.fetched;
    this.setFlag(FLAG_C, this.y >= this.fetched);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    return 0;
  };

  DEC = (): number => {
    this.fetch();
    const temp = (this.fetched - 1) & 0xFF;
    this.bus.write(this.addrAbs, temp);
    this.setFlag(FLAG_Z, temp === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    return 0;
  };

  DEX = (): number => {
    this.x = (this.x - 1) & 0xFF;
    this.setFlag(FLAG_Z, this.x === 0);
    this.setFlag(FLAG_N, (this.x & 0x80) !== 0);
    return 0;
  };

  DEY = (): number => {
    this.y = (this.y - 1) & 0xFF;
    this.setFlag(FLAG_Z, this.y === 0);
    this.setFlag(FLAG_N, (this.y & 0x80) !== 0);
    return 0;
  };

  EOR = (): number => {
    this.fetch();
    this.a ^= this.fetched;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 1;
  };

  INC = (): number => {
    this.fetch();
    const temp = (this.fetched + 1) & 0xFF;
    this.bus.write(this.addrAbs, temp);
    this.setFlag(FLAG_Z, temp === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    return 0;
  };

  INX = (): number => {
    this.x = (this.x + 1) & 0xFF;
    this.setFlag(FLAG_Z, this.x === 0);
    this.setFlag(FLAG_N, (this.x & 0x80) !== 0);
    return 0;
  };

  INY = (): number => {
    this.y = (this.y + 1) & 0xFF;
    this.setFlag(FLAG_Z, this.y === 0);
    this.setFlag(FLAG_N, (this.y & 0x80) !== 0);
    return 0;
  };

  JMP = (): number => {
    this.pc = this.addrAbs;
    return 0;
  };

  JSR = (): number => {
    this.pc--;
    this.stackPush((this.pc >> 8) & 0xFF);
    this.stackPush(this.pc & 0xFF);
    this.pc = this.addrAbs;
    return 0;
  };

  LDA = (): number => {
    this.fetch();
    this.a = this.fetched;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 1;
  };

  LDX = (): number => {
    this.fetch();
    this.x = this.fetched;
    this.setFlag(FLAG_Z, this.x === 0);
    this.setFlag(FLAG_N, (this.x & 0x80) !== 0);
    return 1;
  };

  LDY = (): number => {
    this.fetch();
    this.y = this.fetched;
    this.setFlag(FLAG_Z, this.y === 0);
    this.setFlag(FLAG_N, (this.y & 0x80) !== 0);
    return 1;
  };

  LSR = (): number => {
    this.fetch();
    this.setFlag(FLAG_C, (this.fetched & 0x01) !== 0);
    const temp = this.fetched >> 1;
    this.setFlag(FLAG_Z, temp === 0);
    this.setFlag(FLAG_N, false);
    if (this.lookup[this.opcode].mode === this.IMP) {
      this.a = temp;
    } else {
      this.bus.write(this.addrAbs, temp);
    }
    return 0;
  };

  NOP = (): number => {
    switch (this.opcode) {
      case 0x1C: case 0x3C: case 0x5C: case 0x7C: case 0xDC: case 0xFC:
        return 1;
      default:
        return 0;
    }
  };

  ORA = (): number => {
    this.fetch();
    this.a |= this.fetched;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 1;
  };

  PHA = (): number => {
    this.stackPush(this.a);
    return 0;
  };

  PHP = (): number => {
    this.stackPush(this.status | FLAG_B | FLAG_U);
    return 0;
  };

  PLA = (): number => {
    this.a = this.stackPop();
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 0;
  };

  PLP = (): number => {
    this.status = this.stackPop();
    this.setFlag(FLAG_U, true);
    this.setFlag(FLAG_B, false);
    return 0;
  };

  ROL = (): number => {
    this.fetch();
    const temp = (this.fetched << 1) | this.getFlag(FLAG_C);
    this.setFlag(FLAG_C, (temp & 0xFF00) !== 0);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    if (this.lookup[this.opcode].mode === this.IMP) {
      this.a = temp & 0xFF;
    } else {
      this.bus.write(this.addrAbs, temp & 0xFF);
    }
    return 0;
  };

  ROR = (): number => {
    this.fetch();
    const temp = (this.fetched >> 1) | (this.getFlag(FLAG_C) << 7);
    this.setFlag(FLAG_C, (this.fetched & 0x01) !== 0);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    if (this.lookup[this.opcode].mode === this.IMP) {
      this.a = temp & 0xFF;
    } else {
      this.bus.write(this.addrAbs, temp & 0xFF);
    }
    return 0;
  };

  RTI = (): number => {
    this.status = this.stackPop();
    this.setFlag(FLAG_B, false);
    this.setFlag(FLAG_U, true);
    this.pc = this.stackPop() | (this.stackPop() << 8);
    return 0;
  };

  RTS = (): number => {
    this.pc = (this.stackPop() | (this.stackPop() << 8)) + 1;
    return 0;
  };

  SBC = (): number => {
    this.fetch();
    const value = this.fetched ^ 0xFF;
    const temp = this.a + value + this.getFlag(FLAG_C);
    this.setFlag(FLAG_C, temp > 0xFF);
    this.setFlag(FLAG_Z, (temp & 0xFF) === 0);
    this.setFlag(FLAG_V, ((temp ^ this.a) & (temp ^ value) & 0x80) !== 0);
    this.setFlag(FLAG_N, (temp & 0x80) !== 0);
    this.a = temp & 0xFF;
    return 1;
  };

  SEC = (): number => {
    this.setFlag(FLAG_C, true);
    return 0;
  };

  SED = (): number => {
    this.setFlag(FLAG_D, true);
    return 0;
  };

  SEI = (): number => {
    this.setFlag(FLAG_I, true);
    return 0;
  };

  STA = (): number => {
    this.bus.write(this.addrAbs, this.a);
    return 0;
  };

  STX = (): number => {
    this.bus.write(this.addrAbs, this.x);
    return 0;
  };

  STY = (): number => {
    this.bus.write(this.addrAbs, this.y);
    return 0;
  };

  TAX = (): number => {
    this.x = this.a;
    this.setFlag(FLAG_Z, this.x === 0);
    this.setFlag(FLAG_N, (this.x & 0x80) !== 0);
    return 0;
  };

  TAY = (): number => {
    this.y = this.a;
    this.setFlag(FLAG_Z, this.y === 0);
    this.setFlag(FLAG_N, (this.y & 0x80) !== 0);
    return 0;
  };

  TSX = (): number => {
    this.x = this.sp;
    this.setFlag(FLAG_Z, this.x === 0);
    this.setFlag(FLAG_N, (this.x & 0x80) !== 0);
    return 0;
  };

  TXA = (): number => {
    this.a = this.x;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 0;
  };

  TXS = (): number => {
    this.sp = this.x;
    return 0;
  };

  TYA = (): number => {
    this.a = this.y;
    this.setFlag(FLAG_Z, this.a === 0);
    this.setFlag(FLAG_N, (this.a & 0x80) !== 0);
    return 0;
  };

  XXX = (): number => {
    return 0;
  };

  // ── Opcode table ────────────────────────────────────────────────

  lookup: Array<{ name: string; operate: () => number; mode: () => number; cycles: number }> = [];

  buildLookup(): void {
    const op = (name: string, fn: () => number, mode: () => number, cycles: number) => ({ name, operate: fn.bind(this), mode: mode.bind(this), cycles });
    this.lookup = [
      /* 0x00 */ op('BRK', this.BRK, this.IMP, 7), op('ORA', this.ORA, this.IZX, 6), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 3), op('ORA', this.ORA, this.ZP0, 3), op('ASL', this.ASL, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('PHP', this.PHP, this.IMP, 3), op('ORA', this.ORA, this.IMM, 2), op('ASL', this.ASL, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('???', this.NOP, this.IMP, 4), op('ORA', this.ORA, this.ABS, 4), op('ASL', this.ASL, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0x10 */ op('BPL', this.BPL, this.REL, 2), op('ORA', this.ORA, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('ORA', this.ORA, this.ZPX, 4), op('ASL', this.ASL, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('CLC', this.CLC, this.IMP, 2), op('ORA', this.ORA, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('ORA', this.ORA, this.ABX, 4), op('ASL', this.ASL, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
      /* 0x20 */ op('JSR', this.JSR, this.ABS, 6), op('AND', this.AND, this.IZX, 6), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('BIT', this.BIT, this.ZP0, 3), op('AND', this.AND, this.ZP0, 3), op('ROL', this.ROL, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('PLP', this.PLP, this.IMP, 4), op('AND', this.AND, this.IMM, 2), op('ROL', this.ROL, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('BIT', this.BIT, this.ABS, 4), op('AND', this.AND, this.ABS, 4), op('ROL', this.ROL, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0x30 */ op('BMI', this.BMI, this.REL, 2), op('AND', this.AND, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('AND', this.AND, this.ZPX, 4), op('ROL', this.ROL, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('SEC', this.SEC, this.IMP, 2), op('AND', this.AND, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('AND', this.AND, this.ABX, 4), op('ROL', this.ROL, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
      /* 0x40 */ op('RTI', this.RTI, this.IMP, 6), op('EOR', this.EOR, this.IZX, 6), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 3), op('EOR', this.EOR, this.ZP0, 3), op('LSR', this.LSR, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('PHA', this.PHA, this.IMP, 3), op('EOR', this.EOR, this.IMM, 2), op('LSR', this.LSR, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('JMP', this.JMP, this.ABS, 3), op('EOR', this.EOR, this.ABS, 4), op('LSR', this.LSR, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0x50 */ op('BVC', this.BVC, this.REL, 2), op('EOR', this.EOR, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('EOR', this.EOR, this.ZPX, 4), op('LSR', this.LSR, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('CLI', this.CLI, this.IMP, 2), op('EOR', this.EOR, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('EOR', this.EOR, this.ABX, 4), op('LSR', this.LSR, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
      /* 0x60 */ op('RTS', this.RTS, this.IMP, 6), op('ADC', this.ADC, this.IZX, 6), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 3), op('ADC', this.ADC, this.ZP0, 3), op('ROR', this.ROR, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('PLA', this.PLA, this.IMP, 4), op('ADC', this.ADC, this.IMM, 2), op('ROR', this.ROR, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('JMP', this.JMP, this.IND, 5), op('ADC', this.ADC, this.ABS, 4), op('ROR', this.ROR, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0x70 */ op('BVS', this.BVS, this.REL, 2), op('ADC', this.ADC, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('ADC', this.ADC, this.ZPX, 4), op('ROR', this.ROR, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('SEI', this.SEI, this.IMP, 2), op('ADC', this.ADC, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('ADC', this.ADC, this.ABX, 4), op('ROR', this.ROR, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
      /* 0x80 */ op('???', this.NOP, this.IMP, 2), op('STA', this.STA, this.IZX, 6), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 6), op('STY', this.STY, this.ZP0, 3), op('STA', this.STA, this.ZP0, 3), op('STX', this.STX, this.ZP0, 3), op('???', this.XXX, this.IMP, 3), op('DEY', this.DEY, this.IMP, 2), op('???', this.NOP, this.IMP, 2), op('TXA', this.TXA, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('STY', this.STY, this.ABS, 4), op('STA', this.STA, this.ABS, 4), op('STX', this.STX, this.ABS, 4), op('???', this.XXX, this.IMP, 4),
      /* 0x90 */ op('BCC', this.BCC, this.REL, 2), op('STA', this.STA, this.IZY, 6), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 6), op('STY', this.STY, this.ZPX, 4), op('STA', this.STA, this.ZPX, 4), op('STX', this.STX, this.ZPY, 4), op('???', this.XXX, this.IMP, 4), op('TYA', this.TYA, this.IMP, 2), op('STA', this.STA, this.ABY, 5), op('TXS', this.TXS, this.IMP, 2), op('???', this.XXX, this.IMP, 5), op('???', this.NOP, this.IMP, 5), op('STA', this.STA, this.ABX, 5), op('???', this.XXX, this.IMP, 5), op('???', this.XXX, this.IMP, 5),
      /* 0xA0 */ op('LDY', this.LDY, this.IMM, 2), op('LDA', this.LDA, this.IZX, 6), op('LDX', this.LDX, this.IMM, 2), op('???', this.XXX, this.IMP, 6), op('LDY', this.LDY, this.ZP0, 3), op('LDA', this.LDA, this.ZP0, 3), op('LDX', this.LDX, this.ZP0, 3), op('???', this.XXX, this.IMP, 3), op('TAY', this.TAY, this.IMP, 2), op('LDA', this.LDA, this.IMM, 2), op('TAX', this.TAX, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('LDY', this.LDY, this.ABS, 4), op('LDA', this.LDA, this.ABS, 4), op('LDX', this.LDX, this.ABS, 4), op('???', this.XXX, this.IMP, 4),
      /* 0xB0 */ op('BCS', this.BCS, this.REL, 2), op('LDA', this.LDA, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 5), op('LDY', this.LDY, this.ZPX, 4), op('LDA', this.LDA, this.ZPX, 4), op('LDX', this.LDX, this.ZPY, 4), op('???', this.XXX, this.IMP, 4), op('CLV', this.CLV, this.IMP, 2), op('LDA', this.LDA, this.ABY, 4), op('TSX', this.TSX, this.IMP, 2), op('???', this.XXX, this.IMP, 4), op('LDY', this.LDY, this.ABX, 4), op('LDA', this.LDA, this.ABX, 4), op('LDX', this.LDX, this.ABY, 4), op('???', this.XXX, this.IMP, 4),
      /* 0xC0 */ op('CPY', this.CPY, this.IMM, 2), op('CMP', this.CMP, this.IZX, 6), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('CPY', this.CPY, this.ZP0, 3), op('CMP', this.CMP, this.ZP0, 3), op('DEC', this.DEC, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('INY', this.INY, this.IMP, 2), op('CMP', this.CMP, this.IMM, 2), op('DEX', this.DEX, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('CPY', this.CPY, this.ABS, 4), op('CMP', this.CMP, this.ABS, 4), op('DEC', this.DEC, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0xD0 */ op('BNE', this.BNE, this.REL, 2), op('CMP', this.CMP, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('CMP', this.CMP, this.ZPX, 4), op('DEC', this.DEC, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('CLD', this.CLD, this.IMP, 2), op('CMP', this.CMP, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('CMP', this.CMP, this.ABX, 4), op('DEC', this.DEC, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
      /* 0xE0 */ op('CPX', this.CPX, this.IMM, 2), op('SBC', this.SBC, this.IZX, 6), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('CPX', this.CPX, this.ZP0, 3), op('SBC', this.SBC, this.ZP0, 3), op('INC', this.INC, this.ZP0, 5), op('???', this.XXX, this.IMP, 5), op('INX', this.INX, this.IMP, 2), op('SBC', this.SBC, this.IMM, 2), op('NOP', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 2), op('CPX', this.CPX, this.ABS, 4), op('SBC', this.SBC, this.ABS, 4), op('INC', this.INC, this.ABS, 6), op('???', this.XXX, this.IMP, 6),
      /* 0xF0 */ op('BEQ', this.BEQ, this.REL, 2), op('SBC', this.SBC, this.IZY, 5), op('???', this.XXX, this.IMP, 2), op('???', this.XXX, this.IMP, 8), op('???', this.NOP, this.IMP, 4), op('SBC', this.SBC, this.ZPX, 4), op('INC', this.INC, this.ZPX, 6), op('???', this.XXX, this.IMP, 6), op('SED', this.SED, this.IMP, 2), op('SBC', this.SBC, this.ABY, 4), op('???', this.NOP, this.IMP, 2), op('???', this.XXX, this.IMP, 7), op('???', this.NOP, this.IMP, 4), op('SBC', this.SBC, this.ABX, 4), op('INC', this.INC, this.ABX, 7), op('???', this.XXX, this.IMP, 7),
    ];
  }

  // ── Step ────────────────────────────────────────────────────────

  step(): number {
    if (this.cycles === 0) {
      this.opcode = this.bus.read(this.pc);
      this.setFlag(FLAG_U, true);
      this.pc++;
      const instr = this.lookup[this.opcode];
      this.cycles = instr.cycles;
      const additionalCycle1 = instr.mode();
      const additionalCycle2 = instr.operate();
      this.cycles += additionalCycle1 & additionalCycle2;
      this.setFlag(FLAG_U, true);
    }
    this.clockCount++;
    this.cycles--;
    return 1;
  }

  // ── Interrupts ──────────────────────────────────────────────────

  nmi(): void {
    this.stackPush((this.pc >> 8) & 0xFF);
    this.stackPush(this.pc & 0xFF);
    this.setFlag(FLAG_B, false);
    this.setFlag(FLAG_U, true);
    this.setFlag(FLAG_I, true);
    this.stackPush(this.status);
    this.addrAbs = 0xFFFA;
    const lo = this.bus.read(this.addrAbs);
    const hi = this.bus.read(this.addrAbs + 1);
    this.pc = (hi << 8) | lo;
    this.cycles = 8;
  }

  irq(): void {
    if (this.getFlag(FLAG_I) === 0) {
      this.stackPush((this.pc >> 8) & 0xFF);
      this.stackPush(this.pc & 0xFF);
      this.setFlag(FLAG_B, false);
      this.setFlag(FLAG_U, true);
      this.setFlag(FLAG_I, true);
      this.stackPush(this.status);
      this.addrAbs = 0xFFFE;
      const lo = this.bus.read(this.addrAbs);
      const hi = this.bus.read(this.addrAbs + 1);
      this.pc = (hi << 8) | lo;
      this.cycles = 7;
    }
  }
}
