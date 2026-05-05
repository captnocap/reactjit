import { exec } from '../../host';

/** Wrap a shell command with timeout so a hanging gpioset can't block the UI. */
function safeExec(cmd: string): string {
  try {
    return exec(`timeout 2 ${cmd}`);
  } catch {
    return '';
  }
}

/** Run gpiodetect to list chips. */
export function gpioDetect(): string {
  return safeExec('gpiodetect 2>&1');
}

/** Run gpioinfo to list lines. */
export function gpioInfo(chip?: string): string {
  return safeExec(`gpioinfo ${chip || ''} 2>&1`);
}

/** Read a single line value. */
export function gpioGet(chip: string, line: number): string {
  return safeExec(`gpioget ${chip} ${line} 2>&1`);
}

/** Set a single line value (single-shot, does not hold the line). */
export function gpioSet(chip: string, line: number, value: boolean): string {
  // timeout 0.1 prevents gpioset (libgpiod v2) from holding the line forever.
  return safeExec(`timeout 0.1 gpioset ${chip} ${line}=${value ? 1 : 0} 2>&1`);
}

/** Scan an I2C bus for devices. */
export function i2cDetect(bus: number): string {
  return safeExec(`i2cdetect -y ${bus} 2>&1`);
}

/** Read a byte from an I2C register. */
export function i2cGetByte(bus: number, addr: number, reg: number): string {
  return safeExec(`i2cget -y ${bus} 0x${addr.toString(16)} 0x${reg.toString(16)} 2>&1`);
}
