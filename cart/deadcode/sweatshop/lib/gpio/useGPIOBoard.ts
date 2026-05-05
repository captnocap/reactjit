import { useState, useEffect, useCallback } from 'react';
import { gpioDetect, gpioInfo } from './exec';
import type { GPIOBoardState, GPIOChipInfo, GPIOLineInfo } from './types';

function parseGpiodetect(raw: string): GPIOChipInfo[] {
  const chips: GPIOChipInfo[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^(gpiochip\d+)\s+\[(.+?)\]\s+\((\d+)\s+lines?\)/);
    if (m) {
      chips.push({ name: m[1], label: m[2], lines: parseInt(m[3], 10) });
    }
  }
  return chips;
}

function parseGpioinfo(raw: string): GPIOLineInfo[] {
  const lines: GPIOLineInfo[] = [];
  let currentChip = '';
  for (const line of raw.split('\n')) {
    const chipMatch = line.match(/^(gpiochip\d+)\s+-\s+\d+\s+lines?:/);
    if (chipMatch) {
      currentChip = chipMatch[1];
      continue;
    }
    // line   0:      unnamed       unused   input  active-high
    // line   4:      unnamed "host-wakeup" input active-high [used]
    // line  29:   "GPIO4_D5"       unused   input  active-high
    const m = line.match(/^\s+line\s+(\d+):\s+(?:"([^"]*)"|unnamed)\s+(?:"([^"]*)"|unused)\s+(input|output)\s+(active-high|active-low)(?:\s+\[used\])?/);
    if (m) {
      lines.push({
        chip: currentChip,
        offset: parseInt(m[1], 10),
        name: m[2] || '',
        consumer: m[3] || '',
        direction: m[4] as 'input' | 'output',
        activeLow: m[5] === 'active-low',
        used: line.includes('[used]'),
      });
    }
  }
  return lines;
}

export function useGPIOBoard(): GPIOBoardState & { refresh: () => void } {
  const [state, setState] = useState<GPIOBoardState>({
    available: false,
    chips: [],
    lines: [],
    error: null,
  });

  const refresh = useCallback(() => {
    const detectOut = gpioDetect();
    if (!detectOut || detectOut.includes('command not found') || detectOut.includes('No such file')) {
      const hasDev = (() => {
        try {
          const out = (globalThis as any).__exec?.('ls /dev/gpiochip* 2>&1') || '';
          return out.includes('/dev/gpiochip');
        } catch {
          return false;
        }
      })();
      if (hasDev) {
        setState({
          available: false,
          chips: [],
          lines: [],
          error: 'GPIO device detected (/dev/gpiochip*) but gpiod utilities (gpiodetect, gpioinfo) are not installed. Run: sudo apt install gpiod',
        });
      } else {
        setState({
          available: false,
          chips: [],
          lines: [],
          error: 'No GPIO hardware detected. /dev/gpiochip* devices not found and gpiod utilities are not installed.',
        });
      }
      return;
    }

    const chips = parseGpiodetect(detectOut);
    const infoOut = gpioInfo();
    const lines = parseGpioinfo(infoOut);

    setState({
      available: chips.length > 0,
      chips,
      lines,
      error: null,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
