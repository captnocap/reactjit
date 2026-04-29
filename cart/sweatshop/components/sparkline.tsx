import { useState, useEffect, useRef } from 'react';
import { Box, Row } from '@reactjit/runtime/primitives';
import { usePulse } from '../anim';

// ── Sparkline bar chart (vertical bars, pure divs) ───────────────────────────

export function Sparkline(props: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  trackColor?: string;
  gap?: number;
}) {
  const { data, color, width = 20, height = 12, trackColor, gap = 0 } = props;
  if (!data || data.length === 0) {
    return <Box style={{ width, height, backgroundColor: trackColor || '#1a1f2b' }} />;
  }
  const max = Math.max(...data, 1);
  const barW = Math.max(1, Math.floor((width - (data.length - 1) * gap) / data.length));

  return (
    <Row style={{ width, height, alignItems: 'flex-end', gap }}>
      {data.map((v, i) => (
        <Box
          key={i}
          style={{
            width: barW,
            height: Math.max(1, Math.round((v / max) * height)),
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      ))}
    </Row>
  );
}

// ── XP / level-style progress bar with optional glow ─────────────────────────

export function XPBar(props: {
  fill: number;
  color: string;
  glow?: boolean;
  width?: number;
  height?: number;
  label?: string;
}) {
  const { fill, color, glow, width = 50, height = 6, label } = props;
  const pulse = usePulse(0.5, 1, 1000);
  const pct = Math.max(0, Math.min(1, fill));

  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      {label ? (
        <Text fontSize={9} color={color} style={{ fontWeight: 'bold' }}>
          {label}
        </Text>
      ) : null}
      <Box
        style={{
          width,
          height,
          backgroundColor: '#1a1f2b',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box style={{ width: `${pct * 100}%`, height, backgroundColor: color }} />
        {glow ? (
          <Box
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${pct * 100}%`,
              height,
              backgroundColor: color,
              opacity: pulse,
            }}
          />
        ) : null}
      </Box>
    </Row>
  );
}

function Text(props: any) {
  return React.createElement('Text', props, props.children);
}

// ── Sampler hooks ────────────────────────────────────────────────────────────

export function useSparklineSampler(
  read: () => number,
  intervalMs: number = 1000,
  cap: number = 60
): number[] {
  const [samples, setSamples] = useState<number[]>([]);
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    const id = setInterval(() => {
      const val = readRef.current();
      setSamples((prev) => {
        const next = [...prev, val];
        if (next.length > cap) next.shift();
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, cap]);

  return samples;
}

export function useDeltaSampler(
  read: () => number,
  intervalMs: number = 1000,
  cap: number = 60
): number[] {
  const [samples, setSamples] = useState<number[]>([]);
  const readRef = useRef(read);
  const lastRef = useRef<number>(0);
  readRef.current = read;

  useEffect(() => {
    const id = setInterval(() => {
      const val = readRef.current();
      const delta = val - lastRef.current;
      lastRef.current = val;
      setSamples((prev) => {
        const next = [...prev, Math.max(0, delta)];
        if (next.length > cap) next.shift();
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, cap]);

  return samples;
}

export function useFPSSampler(cap: number = 60): number[] {
  const [samples, setSamples] = useState<number[]>([]);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const host = globalThis as any;
    const orig = host.__jsTick;

    host.__jsTick = (now: number) => {
      frameCountRef.current++;
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
        setSamples((prev) => {
          const next = [...prev, Math.min(144, fps)];
          if (next.length > cap) next.shift();
          return next;
        });
      }
      if (typeof orig === 'function') orig(now);
    };

    return () => {
      host.__jsTick = orig;
    };
  }, [cap]);

  return samples;
}
