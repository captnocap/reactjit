/**
 * CpuSparkline — tiny Unicode block sparkline for the status bar.
 *
 * Keeps a rolling buffer of CPU samples and renders them as a
 * single Text element using Unicode block characters (same trick
 * as SystemPanel's heatmap, but temporal instead of per-core).
 */
import React, { useRef, useState } from 'react';
import { Text, useSystemMonitor, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const BLOCKS = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
const MAX_SAMPLES = 20;

function toBlock(pct: number): string {
  return BLOCKS[Math.min(7, Math.floor(pct / 100 * 8))] || BLOCKS[0];
}

function sparkColor(latest: number): string {
  if (latest > 80) return C.deny;
  if (latest > 50) return C.warning;
  return C.textDim;
}

export const CpuSparkline = React.memo(function CpuSparkline() {
  // Staggered from SystemPanel (5000ms) to avoid same-frame spikes
  const sys = useSystemMonitor({ interval: 5500 });
  const samplesRef = useRef<number[]>([]);
  const [display, setDisplay] = useState('');
  const [color, setColor] = useState(C.textDim);

  // Staggered: cpu=2700, ralph_graph=3000, tokenUsage=3500
  useLuaInterval(2700, () => {
    const total = sys.cpu?.total ?? 0;
    const samples = samplesRef.current;
    samples.push(total);
    if (samples.length > MAX_SAMPLES) samples.shift();
    setDisplay(samples.map(toBlock).join(''));
    setColor(sparkColor(total));
  });

  if (!display) return null;

  return (
    <Text style={{ fontSize: 8, color, letterSpacing: 0.5 }}>{display}</Text>
  );
});
