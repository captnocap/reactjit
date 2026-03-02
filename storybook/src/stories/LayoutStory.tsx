/**
 * LayoutStory — How things sit next to each other.
 *
 * Flex layout, spacing, sizing. Everything about arranging boxes
 * relative to one another.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  red: '#ef4444', orange: '#f97316', amber: '#eab308',
  green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  pink: '#ec4899', rose: '#f43f5e', purple: '#a855f7',
};

// ── Helpers ─────────────────────────────────────────────────────────

function Chip({ label, color, size = 36 }: { label: string; color: string; size?: number }) {
  return (
    <Box style={{
      width: size, height: size, backgroundColor: color,
      borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

function Bar({ label, width, color }: { label: string; width: number; color: string }) {
  return (
    <Box style={{
      width, height: 26, backgroundColor: color,
      borderRadius: 5, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function LayoutStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Layout'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Flex layout, spacing, and sizing. How things sit next to each other.'}
      </Text>

      {/* ──────────────────── 1. Spacing ────────────────────────────── */}
      <StorySection index={1} title="Spacing">
        <StyleDemo properties={[{
          property: 'padding',
          ways: ways([
            ['style={}', 'padding: 16'],
            ['shorthand', 'padding={16}'],
          ]),
        }]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 16, width: '100%', alignItems: 'center' }}>
            <Box bg={P.blue} radius={5} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'padding: 16'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[
          { property: 'paddingLeft / paddingRight', ways: ways([
            ['style={}', 'paddingLeft: 24, paddingRight: 24'],
            ['shorthand', 'px={24}'],
          ]) },
          { property: 'paddingTop / paddingBottom', ways: ways([
            ['style={}', 'paddingTop: 8, paddingBottom: 8'],
            ['shorthand', 'py={8}'],
          ]) },
        ]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, width: '100%', alignItems: 'center' }}>
            <Box bg={P.indigo} radius={5} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'px=24 py=8'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'gap',
          ways: ways([
            ['style={}', 'gap: 16'],
            ['shorthand', 'gap={16}'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, width: '100%', justifyContent: 'center' }}>
            <Chip label="A" color={P.red} />
            <Chip label="B" color={P.orange} />
            <Chip label="C" color={P.amber} />
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'margin',
          ways: ways([
            ['style={}', 'marginLeft: 20'],
            ['note', 'No shorthand prop for margin per-side'],
          ]),
        }]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, flexDirection: 'row', width: '100%', justifyContent: 'center' }}>
            <Box style={{ width: 36, height: 36, backgroundColor: P.red, borderRadius: 5 }} />
            <Box style={{ width: 36, height: 36, backgroundColor: P.orange, borderRadius: 5, marginLeft: 20 }} />
            <Box style={{ width: 36, height: 36, backgroundColor: P.amber, borderRadius: 5, marginLeft: 8 }} />
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 2. Flex Direction + Justify ──────────── */}
      <StorySection index={2} title="Flex Direction and Justify">
        <StyleDemo properties={[{
          property: 'flexDirection + justifyContent',
          ways: ways([
            ['style={}', 'flexDirection: "row", justifyContent: "space-between"'],
            ['shorthand', 'direction="row" justify="space-between"'],
          ]),
        }]}>
          <Box style={{ width: '100%', gap: 4, alignItems: 'center' }}>
            {(['start', 'center', 'space-between', 'space-around'] as const).map(justify => (
              <Box key={justify} style={{
                width: '100%', flexDirection: 'row', justifyContent: justify,
                backgroundColor: c.surface, borderRadius: 6, padding: 6,
              }}>
                <Chip label="A" color={P.red} />
                <Chip label="B" color={P.orange} />
                <Chip label="C" color={P.amber} />
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Align Items ──────────────────────── */}
      <StorySection index={3} title="Align Items">
        <StyleDemo properties={[{
          property: 'alignItems',
          ways: ways([
            ['style={}', 'alignItems: "center"'],
            ['shorthand', 'align="center"'],
          ]),
        }]}>
          <Box style={{ width: '100%', flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {(['start', 'center', 'end'] as const).map(align => (
              <Box key={align} style={{
                flexGrow: 1, height: 80, backgroundColor: c.surface,
                borderRadius: 6, padding: 6, gap: 4, alignItems: align,
              }}>
                <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{`align: ${align}`}</Text>
                <Bar label="Short" width={52} color={P.blue} />
                <Bar label="Long" width={74} color={P.indigo} />
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 4. Flex Wrap ────────────────────────── */}
      <StorySection index={4} title="Flex Wrap">
        <StyleDemo properties={[{
          property: 'flexWrap',
          ways: ways([
            ['style={}', 'flexWrap: "wrap"'],
            ['shorthand', 'wrap'],
          ]),
        }]}>
          <Box style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 6,
            backgroundColor: c.surface, borderRadius: 6, padding: 8, width: '100%',
            justifyContent: 'center',
          }}>
            {[P.red, P.orange, P.amber, P.green, P.teal, P.cyan, P.blue, P.indigo].map((color, i) => (
              <Chip key={i} label={`${i + 1}`} color={color} size={32} />
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 5. Sizing ─────────────────────────────── */}
      <StorySection index={5} title="Sizing">
        <StyleDemo properties={[{
          property: 'width / height',
          ways: ways([
            ['style={}', 'width: 200, height: 60'],
            ['shorthand', 'w={200} h={60}'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center' }}>
            <Box w={200} h={60} bg={P.blue} radius={6} style={{ justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'200 x 60'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'fill (width + height 100%)',
          ways: ways([
            ['style={}', 'width: "100%", height: "100%"'],
            ['shorthand', 'fill'],
          ]),
        }, {
          property: 'flexGrow',
          ways: ways([
            ['style={}', 'flexGrow: 1'],
            ['shorthand', 'grow'],
          ]),
        }]}>
          <Box style={{ width: '100%', flexDirection: 'row', gap: 6, height: 50, justifyContent: 'center' }}>
            <Box style={{ width: 60, height: 50, backgroundColor: P.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'fixed'}</Text>
            </Box>
            <Box grow bg={P.green} radius={6} style={{ height: 50, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'grow (fills remaining)'}</Text>
            </Box>
            <Box style={{ width: 60, height: 50, backgroundColor: P.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'fixed'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 6. Flex Shrink ─────────────────────── */}
      <StorySection index={6} title="Flex Shrink">
        <StyleDemo properties={[{
          property: 'flexShrink',
          ways: ways([
            ['style={}', 'flexShrink: 0  (won\'t shrink)'],
            ['default', 'flexShrink: 1  (default — items shrink equally)'],
            ['ratio', 'flexShrink: 2 means shrinks twice as fast as 1'],
          ]),
        }]}>
          <Box style={{ gap: 8, width: '100%', alignItems: 'center' }}>
            {/* rjit-ignore-next-line */}
            <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left', width: '100%' }}>{'Default shrink (items wider than 250px container)'}</Text>
            <Box style={{ width: 250, flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderRadius: 6, padding: 6, justifyContent: 'center' }}>
              <Box style={{ width: 120, height: 36, backgroundColor: P.red, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'120px'}</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: P.orange, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'120px'}</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: P.amber, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'120px'}</Text>
              </Box>
            </Box>

            {/* rjit-ignore-next-line */}
            <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left', width: '100%' }}>{'First item flexShrink: 0'}</Text>
            <Box style={{ width: 250, flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderRadius: 6, padding: 6, justifyContent: 'center' }}>
              <Box style={{ width: 120, height: 36, flexShrink: 0, backgroundColor: P.blue, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'No shrink'}</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: P.indigo, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Shrinks'}</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: P.violet, borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Shrinks'}</Text>
              </Box>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 7. Aspect Ratio ─────────────────────── */}
      <StorySection index={7} title="Aspect Ratio">
        <StyleDemo properties={[{
          property: 'aspectRatio',
          ways: ways([
            ['style={}', 'aspectRatio: 16 / 9'],
            ['note', 'Requires at least one explicit dimension (width or height)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
            <Box style={{ width: 60, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'1:1'}</Text>
            </Box>
            <Box style={{ width: 120, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'16:9'}</Text>
            </Box>
            <Box style={{ height: 40, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'2:1'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
