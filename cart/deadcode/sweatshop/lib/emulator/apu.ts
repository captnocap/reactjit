/**
 * APU — NES Audio Processing Unit (stub)
 *
 * Skeleton with correct register interface.
 * Audio synthesis TODO: triangle, pulse, noise, DMC channels.
 */

export class APU {
  // Registers
  pulse1Ctrl = 0;
  pulse1Ramp = 0;
  pulse1TimerLow = 0;
  pulse1Length = 0;
  pulse2Ctrl = 0;
  pulse2Ramp = 0;
  pulse2TimerLow = 0;
  pulse2Length = 0;
  triangleCtrl = 0;
  triangleTimerLow = 0;
  triangleLength = 0;
  triangleCounter = 0;
  noiseCtrl = 0;
  noisePeriod = 0;
  noiseLength = 0;
  dmcCtrl = 0;
  dmcDirectLoad = 0;
  dmcSampleAddr = 0;
  dmcSampleLength = 0;
  status = 0;
  frameCounter = 0;

  cycle = 0;

  reset(): void {
    this.pulse1Ctrl = 0;
    this.pulse1Ramp = 0;
    this.pulse1TimerLow = 0;
    this.pulse1Length = 0;
    this.pulse2Ctrl = 0;
    this.pulse2Ramp = 0;
    this.pulse2TimerLow = 0;
    this.pulse2Length = 0;
    this.triangleCtrl = 0;
    this.triangleTimerLow = 0;
    this.triangleLength = 0;
    this.triangleCounter = 0;
    this.noiseCtrl = 0;
    this.noisePeriod = 0;
    this.noiseLength = 0;
    this.dmcCtrl = 0;
    this.dmcDirectLoad = 0;
    this.dmcSampleAddr = 0;
    this.dmcSampleLength = 0;
    this.status = 0;
    this.frameCounter = 0;
    this.cycle = 0;
  }

  readRegister(addr: number): number {
    if (addr === 0x4015) {
      // Status read
      return this.status;
    }
    return 0;
  }

  writeRegister(addr: number, value: number): void {
    switch (addr) {
      case 0x4000: this.pulse1Ctrl = value; break;
      case 0x4001: this.pulse1Ramp = value; break;
      case 0x4002: this.pulse1TimerLow = value; break;
      case 0x4003: this.pulse1Length = value; break;
      case 0x4004: this.pulse2Ctrl = value; break;
      case 0x4005: this.pulse2Ramp = value; break;
      case 0x4006: this.pulse2TimerLow = value; break;
      case 0x4007: this.pulse2Length = value; break;
      case 0x4008: this.triangleCtrl = value; break;
      case 0x4009: break; // unused
      case 0x400A: this.triangleTimerLow = value; break;
      case 0x400B: this.triangleLength = value; break;
      case 0x400C: this.noiseCtrl = value; break;
      case 0x400D: break; // unused
      case 0x400E: this.noisePeriod = value; break;
      case 0x400F: this.noiseLength = value; break;
      case 0x4010: this.dmcCtrl = value; break;
      case 0x4011: this.dmcDirectLoad = value; break;
      case 0x4012: this.dmcSampleAddr = value; break;
      case 0x4013: this.dmcSampleLength = value; break;
      case 0x4015: this.status = value; break;
      case 0x4017: this.frameCounter = value; break;
    }
  }

  step(cycles: number): void {
    // TODO: actual audio synthesis
    this.cycle += cycles;
  }

  getSample(): number {
    // TODO: mix channels
    return 0;
  }
}
