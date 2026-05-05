// EffectProfilerOverlay — keyboard-toggled (Ctrl+Shift+F) floating
// panel that polls __getTopEffects every 500ms and shows the worst
// offenders by total effect time. Backed by runtime/effect_tracker.ts.
//
// Hidden by default. Press Ctrl+Shift+F to toggle. Click "reset" on
// the panel to zero the stats (useful when isolating a specific
// interaction — e.g. mount the gallery, hit reset, scroll, see which
// components paid). Click "×" or press the chord again to dismiss.

import * as React from 'react';
import { Box, Text, Pressable } from '@reactjit/runtime/primitives';
import { useIFTTT } from '@reactjit/runtime/hooks/useIFTTT';

import { useEffect, useState } from 'react';
type EffectRow = {
  owner: string;
  hookKind: 'effect' | 'layoutEffect';
  totalMs: number;
  avgMs: number;
  runCount: number;
  cleanupMs: number;
  cleanupCount: number;
  depFlips: Record<number, number>;
};

type Summary = {
  componentCount: number;
  totalRuns: number;
  totalMs: number;
};

const POLL_MS = 500;

function formatDepFlips(flips: Record<number, number>): string {
  const keys = Object.keys(flips);
  if (keys.length === 0) return '';
  return keys
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => `[${k}]×${flips[Number(k)]}`)
    .join(' ');
}

export function EffectProfilerOverlay(): any {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EffectRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ componentCount: 0, totalRuns: 0, totalMs: 0 });

  // Ctrl+Shift+F toggles visibility. The IFTTT keyboard source listens
  // at the engine level (regardless of focused input), so the chord
  // works even when typing in the chat box. Pick something unlikely
  // to collide — Ctrl+F alone is browser-find, plain F would steal
  // letter input from text fields.
  useIFTTT('key:ctrl+shift+f', () => setOpen((v) => !v));

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const host: any = globalThis as any;
      if (typeof host.__getTopEffects === 'function') {
        try {
          setRows(host.__getTopEffects(10));
        } catch {}
      }
      if (typeof host.__effectStatsSummary === 'function') {
        try {
          setSummary(host.__effectStatsSummary());
        } catch {}
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 50,
        right: 8,
        width: 380,
        maxHeight: 500,
        backgroundColor: '#0a0a0d',
        borderWidth: 1,
        borderColor: '#3a3a40',
        borderRadius: 6,
        flexDirection: 'column',
      }}
    >
      <Box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 8,
          paddingRight: 4,
          paddingTop: 4,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: '#2a2a2e',
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ff7a3d', fontFamily: 'monospace' }}>
          {`EFFECTS  ${summary.componentCount} comp · ${summary.totalRuns} runs · ${summary.totalMs.toFixed(0)}ms`}
        </Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            onPress={() => {
              const host: any = globalThis as any;
              if (typeof host.__resetEffectStats === 'function') host.__resetEffectStats();
              setRows([]);
              setSummary({ componentCount: 0, totalRuns: 0, totalMs: 0 });
            }}
          >
            <Box
              style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderWidth: 1,
                borderColor: '#3a3a40',
                borderRadius: 3,
              }}
            >
              <Text style={{ fontSize: 9, color: '#92a8c4', fontFamily: 'monospace' }}>reset</Text>
            </Box>
          </Pressable>
          <Pressable onPress={() => setOpen(false)}>
            <Box
              style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderWidth: 1,
                borderColor: '#3a3a40',
                borderRadius: 3,
              }}
            >
              <Text style={{ fontSize: 9, color: '#92a8c4', fontFamily: 'monospace' }}>×</Text>
            </Box>
          </Pressable>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'column', paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4 }}>
        <Box style={{ flexDirection: 'row', paddingBottom: 2 }}>
          <Text style={{ flexGrow: 1, fontSize: 8, color: '#666', fontFamily: 'monospace' }}>component</Text>
          <Text style={{ width: 50, fontSize: 8, color: '#666', fontFamily: 'monospace', textAlign: 'right' }}>total</Text>
          <Text style={{ width: 40, fontSize: 8, color: '#666', fontFamily: 'monospace', textAlign: 'right' }}>runs</Text>
          <Text style={{ width: 40, fontSize: 8, color: '#666', fontFamily: 'monospace', textAlign: 'right' }}>avg</Text>
        </Box>
        {rows.length === 0 ? (
          <Text style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', paddingTop: 4 }}>
            (no effects yet — interact with the app)
          </Text>
        ) : (
          rows.map((r, i) => {
            const flipsStr = formatDepFlips(r.depFlips);
            const tone = r.runCount > 50 ? '#ff7a3d' : r.runCount > 10 ? '#e8eef8' : '#92a8c4';
            return (
              <Box
                key={`${r.owner}-${r.hookKind}-${i}`}
                style={{
                  flexDirection: 'column',
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: '#1a1a1d',
                }}
              >
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    style={{ flexGrow: 1, fontSize: 9, color: tone, fontFamily: 'monospace' }}
                  >
                    {r.owner}
                    {r.hookKind === 'layoutEffect' ? ' (L)' : ''}
                  </Text>
                  <Text
                    style={{ width: 50, fontSize: 9, color: tone, fontFamily: 'monospace', textAlign: 'right' }}
                  >
                    {r.totalMs.toFixed(1)}
                  </Text>
                  <Text
                    style={{ width: 40, fontSize: 9, color: tone, fontFamily: 'monospace', textAlign: 'right' }}
                  >
                    {r.runCount}
                  </Text>
                  <Text
                    style={{ width: 40, fontSize: 9, color: tone, fontFamily: 'monospace', textAlign: 'right' }}
                  >
                    {r.avgMs.toFixed(2)}
                  </Text>
                </Box>
                {flipsStr ? (
                  <Text style={{ fontSize: 8, color: '#666', fontFamily: 'monospace', paddingLeft: 4 }}>
                    {`flips ${flipsStr}`}
                  </Text>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
