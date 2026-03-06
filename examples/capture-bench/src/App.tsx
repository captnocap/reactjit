/**
 * Capture Bench — minimal app for measuring pure recording overhead.
 *
 * Nothing but a frame counter and a colored box. Records MP4 on button
 * press and displays frame timing metrics to measure how much the
 * recorder impacts performance in isolation.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, useRecorder, useLoveRPC, useLuaInterval } from '@reactjit/core';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  accent: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
  text: '#e2e8f0',
  muted: '#64748b',
};

type PerfStats = { fps?: number; layoutMs?: number; paintMs?: number };

export function App() {
  const { recording, frames, duration, start, stop } = useRecorder();
  const getPerf = useLoveRPC<PerfStats>('dev:perf');
  const [perf, setPerf] = useState<PerfStats>({});
  const [frameCount, setFrameCount] = useState(0);
  const droppedRef = useRef(0);

  // Tick frame counter every 16ms
  useLuaInterval(16, () => {
    setFrameCount(n => n + 1);
  });

  // Poll perf every 500ms
  useLuaInterval(500, async () => {
    const next = await getPerf();
    if (next) {
      setPerf(next);
      if (next.fps && next.fps < 55) droppedRef.current += 1;
    }
  });

  const toggle = useCallback(() => {
    if (recording) { stop(); } else { start({ fps: 30, format: 'mp4' }); }
  }, [recording, start, stop]);

  const fps = perf.fps ?? 0;
  const fpsColor = fps >= 55 ? C.green : fps >= 30 ? C.yellow : C.red;

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: 32,
    }}>
      {/* Title */}
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>Capture Bench</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>
        {`Minimal app — measures pure recording overhead`}
      </Text>

      {/* Frame counter box */}
      <Box style={{
        width: 200,
        height: 200,
        backgroundColor: C.accent,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color: '#1e1e2e', fontSize: 48, fontWeight: '700' }}>
          {`${frameCount}`}
        </Text>
        <Text style={{ color: '#1e1e2e', fontSize: 11 }}>frames</Text>
      </Box>

      {/* Metrics */}
      <Box style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
        <Box style={{ gap: 2, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 10 }}>FPS</Text>
          <Text style={{ color: fpsColor, fontSize: 20, fontWeight: '700' }}>{`${Math.round(fps)}`}</Text>
        </Box>
        <Box style={{ gap: 2, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 10 }}>Layout</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>{`${(perf.layoutMs ?? 0).toFixed(1)}`}</Text>
        </Box>
        <Box style={{ gap: 2, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 10 }}>Paint</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>{`${(perf.paintMs ?? 0).toFixed(1)}`}</Text>
        </Box>
        <Box style={{ gap: 2, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 10 }}>Dips</Text>
          <Text style={{ color: droppedRef.current > 0 ? C.red : C.green, fontSize: 20, fontWeight: '700' }}>
            {`${droppedRef.current}`}
          </Text>
        </Box>
      </Box>

      {/* Recording info */}
      {recording && (
        <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Text style={{ color: C.accent, fontSize: 14, fontWeight: '700' }}>
            {`REC ${frames} frames / ${duration.toFixed(1)}s`}
          </Text>
        </Box>
      )}

      {/* Record button */}
      <Pressable onPress={toggle} style={{
        backgroundColor: recording ? C.red : C.green,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: 8,
      }}>
        <Text style={{ color: '#1e1e2e', fontSize: 14, fontWeight: '700' }}>
          {recording ? 'Stop Recording' : 'Record MP4 (30fps)'}
        </Text>
      </Pressable>
    </Box>
  );
}
