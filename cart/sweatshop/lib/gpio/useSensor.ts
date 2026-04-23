const React: any = require('react');
const { useState, useEffect, useCallback, useRef } = React;

import { i2cDetect, i2cGetByte } from './exec';
import type { SensorState, I2CDeviceInfo } from './types';

function parseI2cDetect(raw: string, bus: number): I2CDeviceInfo[] {
  const devices: I2CDeviceInfo[] = [];
  for (const line of raw.split('\n')) {
    // Lines like:  10: -- -- -- -- -- -- -- 1a -- -- -- -- -- -- -- --
    const rowMatch = line.match(/^\s*([0-9a-fA-F]{2}):\s+(.*)$/);
    if (!rowMatch) continue;
    const base = parseInt(rowMatch[1], 16);
    const cells = rowMatch[2].trim().split(/\s+/);
    cells.forEach((cell, i) => {
      if (cell !== '--' && /^[0-9a-fA-F]{2}$/.test(cell)) {
        devices.push({ bus, address: base + i, present: true });
      }
    });
  }
  return devices;
}

export function useSensor(bus: number = 1): SensorState & { refresh: () => void } {
  const [devices, setDevices] = useState<I2CDeviceInfo[]>([]);
  const [reading, setReading] = useState<number | null>(null);
  const [bytes, setBytes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  const refresh = useCallback(() => {
    const out = i2cDetect(bus);
    if (!out || out.includes('command not found') || out.includes('No such file')) {
      setError('i2cdetect not available. Install i2c-tools (sudo apt install i2c-tools) and ensure /dev/i2c-* exists.');
      setDevices([]);
      return;
    }
    if (out.includes('Permission denied')) {
      setError(`Permission denied on /dev/i2c-${bus}. Add user to i2c group or run with sudo.`);
      setDevices([]);
      return;
    }
    const found = parseI2cDetect(out, bus);
    setDevices(found);
    setError(null);

    // If exactly one device, try to read register 0x00
    if (found.length === 1) {
      const byteOut = i2cGetByte(bus, found[0].address, 0x00);
      const trimmed = byteOut.trim();
      if (/^0x[0-9a-fA-F]{2}$/.test(trimmed)) {
        const val = parseInt(trimmed, 16);
        setReading(val);
        setBytes([val]);
      }
    } else {
      setReading(null);
      setBytes([]);
    }
  }, [bus]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  return { devices, reading, bytes, error, refresh };
}
