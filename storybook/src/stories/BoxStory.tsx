/**
 * BoxStory — "Here is a rectangle."
 *
 * The most primitive visual element. Uses ComponentDoc to pull API docs
 * from content.json and provides a visual preview showing what Box IS:
 * structure, nesting, containment, and the visual properties that dress it.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { ComponentDoc, styleTooltip, Wireframe } from './_shared/ComponentDoc';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  green: '#22c55e', cyan: '#06b6d4', amber: '#eab308',
};

// ── Starter code for playground ─────────────────────────────────────

const STARTER_CODE = `<Box style={{ padding: 16, gap: 12, backgroundColor: '#1e1e2e', borderRadius: 10 }}>
  <Box style={{ flexDirection: 'row', gap: 8 }}>
    <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#3b82f6', borderRadius: 6 }} />
    <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#22c55e', borderRadius: 6 }} />
  </Box>
  <Box style={{ height: 60, backgroundColor: '#6366f1', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#fff', fontSize: 12 }}>{'Nested content'}</Text>
  </Box>
</Box>`;

// ── Preview ─────────────────────────────────────────────────────────

function BoxPreview() {
  const c = useThemeColors();

  return (
    <>
      {/* 1. Nesting — wireframe bones */}
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {'CONTAINMENT'}
      </Text>
      <Box style={{ alignItems: 'center' }}>
        <Box
          tooltip={{ content: 'Outer\n260x140', type: 'cursor', layout: 'descriptive' }}
          style={{
            width: 260, height: 140,
            borderWidth: 1, borderColor: c.border,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Box
            tooltip={{ content: 'Middle\n180x90', type: 'cursor', layout: 'descriptive' }}
            style={{
              width: 180, height: 90,
              borderWidth: 1, borderColor: c.border,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Box
              tooltip={{ content: 'Inner\n100x45', type: 'cursor', layout: 'descriptive' }}
              style={{
                width: 100, height: 45,
                borderWidth: 1, borderColor: c.border,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{'children'}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 2. Styled nesting — dressed up */}
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginTop: 8 }}>
        {'STYLED'}
      </Text>
      {(() => {
        const outer = { backgroundColor: c.surface, borderRadius: 14, padding: 16 };
        const mid = { backgroundColor: P.blue, borderRadius: 10, padding: 12 };
        const inner = { backgroundColor: P.violet, borderRadius: 8, padding: 10 };
        return (
          <Box style={{ alignItems: 'center' }}>
            <Box style={{ ...outer, width: 260, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(outer)}>
              <Box style={{ ...mid, width: 200, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(mid)}>
                <Box style={{ ...inner, width: 140, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(inner)}>
                  <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Nested'}</Text>
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })()}

      {/* 3. Border radius scale */}
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginTop: 8 }}>
        {'BORDER RADIUS'}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        {([['0', 0], ['4', 4], ['8', 8], ['12', 12], ['\u221e', 9999]] as const).map(([label, r]) => {
          const custom = { backgroundColor: P.cyan, borderRadius: r };
          return (
            <Box key={label} style={{
              ...custom, width: 36, height: 36,
              justifyContent: 'center', alignItems: 'center',
            }} tooltip={styleTooltip(custom)}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{`${label}`}</Text>
            </Box>
          );
        })}
      </Box>

      {/* 4. Background color formats */}
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginTop: 8 }}>
        {'COLOR'}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {(() => {
          const hex = { backgroundColor: P.blue, borderRadius: 6 };
          const rgba = { backgroundColor: [0.4, 0.2, 0.9, 0.7] as [number, number, number, number], borderRadius: 6 };
          const theme = { backgroundColor: c.primary, borderRadius: 6 };
          return (
            <>
              <Box style={{ ...hex, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(hex)}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'hex'}</Text>
              </Box>
              <Box style={{ ...rgba, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(rgba as any)}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'rgba[]'}</Text>
              </Box>
              <Box style={{ ...theme, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(theme)}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'theme'}</Text>
              </Box>
            </>
          );
        })()}
      </Box>

      {/* 5. Shadow scale */}
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginTop: 8 }}>
        {'SHADOW'}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {([
          ['sm', { shadowColor: 'rgba(0,0,0,0.08)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 }],
          ['md', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 }],
          ['lg', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 }],
        ] as const).map(([name, shadow]) => {
          const custom = { ...shadow, backgroundColor: c.surface, borderRadius: 8, padding: 10 };
          return (
            <Box key={name} style={{
              ...custom,
              minWidth: 56, alignItems: 'center', justifyContent: 'center',
            }} tooltip={styleTooltip(custom)}>
              <Text style={{ color: c.text, fontSize: 8, textAlign: 'center' }}>{`${name}`}</Text>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function BoxStory() {
  return (
    <ComponentDoc
      docKey="box"
      starterCode={STARTER_CODE}
      preview={<BoxPreview />}
      section="Core"
    />
  );
}
