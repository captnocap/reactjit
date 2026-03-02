/**
 * BoxStory — "Here is a rectangle."
 *
 * The most primitive visual element. First show what it IS (structure,
 * nesting, containment), then layer on visual properties.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  green: '#22c55e', red: '#ef4444', orange: '#f97316',
  cyan: '#06b6d4', pink: '#ec4899', amber: '#eab308',
};

// ── Story ───────────────────────────────────────────────────────────

export function BoxStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Box'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'The most primitive visual element. Everything is built from this.'}
      </Text>

      {/* ──────────────────── 1. What a Box Is ──────────────────── */}
      <StorySection index={1} title="A Box Is a Container">
        <StyleDemo properties={[{
          property: 'Box',
          ways: ways([
            ['what', 'A rectangle that holds other rectangles'],
            ['JSX', '<Box> ... children ... </Box>'],
            ['sizing', 'Auto-sizes from children by default'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center' }}>
            <Box
              tooltip={{ content: 'Outer Box\n300x170', type: 'cursor', layout: 'descriptive' }}
              style={{
                width: 300, height: 170,
                borderWidth: 1, borderColor: c.border,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Box
                tooltip={{ content: 'Middle Box\n220x120', type: 'cursor', layout: 'descriptive' }}
                style={{
                  width: 220, height: 120,
                  borderWidth: 1, borderColor: c.border,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Box
                  tooltip={{ content: 'Inner Box\n140x75', type: 'cursor', layout: 'descriptive' }}
                  style={{
                    width: 140, height: 75,
                    borderWidth: 1, borderColor: c.border,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                />
              </Box>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'Styled nesting',
          ways: ways([
            ['pattern', 'Each layer adds its own backgroundColor and borderRadius'],
            ['note', 'Children sit inside their parent — no float, no absolute needed'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center' }}>
            <Box style={{
              width: 300, height: 170,
              backgroundColor: c.surface, borderRadius: 14,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Box style={{
                width: 220, height: 120,
                backgroundColor: c.primary, borderRadius: 12,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Box style={{
                  width: 140, height: 75,
                  backgroundColor: c.accent, borderRadius: 10,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#ffffff', fontSize: 12, textAlign: 'center' }}>{'Centered'}</Text>
                </Box>
              </Box>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 2. Padding ──────────────────── */}
      <StorySection index={2} title="Padding">
        <StyleDemo properties={[{
          property: 'padding',
          ways: ways([
            ['style={}', 'padding: 16'],
            ['shorthand', 'padding={16}'],
            ['what', 'Space between the box edge and its children'],
          ]),
        }]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 16, width: '100%', alignItems: 'center' }}>
            <Box bg={P.blue} radius={5} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'padding: 16 all sides'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[
          { property: 'paddingLeft / paddingRight', ways: ways([
            ['style={}', 'paddingLeft: 32, paddingRight: 32'],
            ['shorthand', 'px={32}'],
          ]) },
          { property: 'paddingTop / paddingBottom', ways: ways([
            ['style={}', 'paddingTop: 8, paddingBottom: 8'],
            ['shorthand', 'py={8}'],
          ]) },
        ]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 32, paddingRight: 32, paddingTop: 8, paddingBottom: 8, width: '100%', alignItems: 'center' }}>
            <Box bg={P.indigo} radius={5} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'px=32 py=8'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Background Color ──────────────────── */}
      <StorySection index={3} title="Background Color">
        <StyleDemo properties={[{
          property: 'backgroundColor',
          ways: ways([
            ['style={}', 'backgroundColor: "#3b82f6"'],
            ['shorthand', 'bg="#3b82f6"'],
            ['theme', 'bg={c.primary}  (via useThemeColors)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
            <Box bg={P.blue} radius={6} style={{ flexGrow: 1, height: 40, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'hex string'}</Text>
            </Box>
            <Box bg={P.green} radius={6} style={{ flexGrow: 1, height: 40, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'shorthand prop'}</Text>
            </Box>
            <Box bg={c.primary} radius={6} style={{ flexGrow: 1, height: 40, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'theme token'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'backgroundColor (RGBA)',
          ways: ways([
            ['style={}', 'backgroundColor: [1, 0.8, 0, 1]'],
            ['format', '[r, g, b, a] — floats 0-1'],
            ['note', 'Love2D native color format'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
            <Box style={{ flexGrow: 1, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: [1, 0.8, 0, 1] }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'[1, 0.8, 0, 1]'}</Text>
            </Box>
            <Box style={{ flexGrow: 1, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: [0.4, 0.2, 0.9, 0.7] }}>
              <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'[0.4, 0.2, 0.9, 0.7]'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 4. Border Radius ──────────────────── */}
      <StorySection index={4} title="Border Radius">
        <StyleDemo properties={[{
          property: 'borderRadius',
          ways: ways([
            ['style={}', 'borderRadius: 8'],
            ['shorthand', 'radius={8}'],
            ['scale', 'none=0  sm=2  md=6  lg=8  xl=12  2xl=16  full=9999'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
            {([['none', 0], ['sm', 2], ['md', 6], ['lg', 8], ['xl', 12], ['full', 9999]] as const).map(([name, r]) => (
              <Box key={name} style={{
                width: 36, height: 36, backgroundColor: P.cyan, borderRadius: r,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 7, textAlign: 'center' }}>{`${name}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 5. Shadow ──────────────────── */}
      <StorySection index={5} title="Shadow">
        <StyleDemo properties={[{
          property: 'shadow (shadowColor + offsets + blur)',
          ways: ways([
            ['style={}', 'shadowColor: "#000", shadowOffsetY: 4, shadowBlur: 12'],
            ['props', 'shadowOffsetX, shadowOffsetY, shadowBlur, shadowColor'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
            {([
              ['sm', { shadowColor: 'rgba(0,0,0,0.08)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 }],
              ['md', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 }],
              ['lg', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 }],
              ['xl', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 20, shadowBlur: 25 }],
            ] as const).map(([name, shadow]) => (
              <Box key={name} style={{
                ...shadow,
                backgroundColor: c.surface, borderRadius: 8, padding: 12,
                minWidth: 70, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: c.text, fontSize: 9, textAlign: 'center' }}>{`shadow ${name}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
