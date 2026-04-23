/**
 * Input — NES controller state
 *
 * 8-button shift register. CPU reads $4016/$4017 to shift out bits.
 */

export class Controller {
  // Button states
  buttons = {
    a: false,
    b: false,
    select: false,
    start: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private shiftReg = 0;
  private strobe = 0;

  setButton(name: keyof typeof this.buttons, pressed: boolean): void {
    this.buttons[name] = pressed;
  }

  read(): number {
    let data = 0;
    if (this.strobe & 1) {
      this.shiftReg =
        (this.buttons.a ? 1 : 0) |
        (this.buttons.b ? 2 : 0) |
        (this.buttons.select ? 4 : 0) |
        (this.buttons.start ? 8 : 0) |
        (this.buttons.up ? 16 : 0) |
        (this.buttons.down ? 32 : 0) |
        (this.buttons.left ? 64 : 0) |
        (this.buttons.right ? 128 : 0);
      data = this.shiftReg & 1;
    } else {
      data = this.shiftReg & 1;
      this.shiftReg >>= 1;
      this.shiftReg |= 0x80; // open bus on unused bits
    }
    return data;
  }

  write(value: number): void {
    this.strobe = value;
    if (this.strobe & 1) {
      this.shiftReg =
        (this.buttons.a ? 1 : 0) |
        (this.buttons.b ? 2 : 0) |
        (this.buttons.select ? 4 : 0) |
        (this.buttons.start ? 8 : 0) |
        (this.buttons.up ? 16 : 0) |
        (this.buttons.down ? 32 : 0) |
        (this.buttons.left ? 64 : 0) |
        (this.buttons.right ? 128 : 0);
    }
  }
}
