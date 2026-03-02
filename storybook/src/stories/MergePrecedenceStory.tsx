/**
 * MergePrecedenceStory — When you mix tw() with shorthand with style={}, who wins?
 *
 * Lives in the Bad Habits section because merge precedence only matters
 * if you're mixing syntaxes — and mixing syntaxes means you're using tw().
 */

import React from 'react';
import { Box, Row, Text, tw } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  blue: '#3b82f6', red: '#ef4444',
};

// ── Story ───────────────────────────────────────────────────────────

export function MergePrecedenceStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Merge Precedence'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'When you mix tw() classes with shorthand props with style={}, here is who wins.'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'left', width: '100%', marginBottom: 8 }}>
        {'Priority: className (tw) < shorthand props < style={}'}
      </Text>

      {/* ──────────────────── 1. className < shorthand ──────────── */}
      <StorySection index={1} title="className loses to shorthand">
        <StyleDemo properties={[{
          property: 'className < shorthand',
          ways: ways([
            ['rule', 'className="p-8" + padding={4}  \u2192  padding wins (4)'],
            ['why', 'Shorthand props override tw() classes'],
          ]),
        }]}>
          <Box className="p-8 bg-red-500 rounded-lg" padding={4} style={{ width: '100%', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'padding=4 overrides className="p-8"'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 2. className < style={} ───────────── */}
      <StorySection index={2} title="className loses to style={}">
        <StyleDemo properties={[{
          property: 'className < style={}',
          ways: ways([
            ['rule', 'className="bg-red-500" + style={{ bg: blue }}  \u2192  blue wins'],
            ['why', 'style={{}} always has highest priority'],
          ]),
        }]}>
          <Box className="bg-red-500 rounded-lg p-4" style={{ backgroundColor: P.blue, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'style={{ bg: blue }} overrides className="bg-red-500"'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Equivalence Proof ──────────────── */}
      <StorySection index={3} title="Equivalence Proof">
        <StyleDemo properties={[{
          property: 'Equivalence proof',
          ways: ways([
            ['left', 'Tailwind classes via tw() / className'],
            ['right', 'Native style={{}} objects'],
            ['result', 'Identical visual output'],
          ]),
        }]}>
          <Row gap={8} style={{ width: '100%', justifyContent: 'center' }}>
            <Box className="flex-1 gap-2">
              <Box className="bg-indigo-600 rounded-lg p-3 flex-row items-center justify-between" style={{ width: '100%' }}>
                <Text style={{ ...tw('text-sm text-white font-bold'), textAlign: 'center' }}>{'tw()'}</Text>
                <Box className="bg-indigo-400 rounded px-2 py-1">
                  <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'badge'}</Text>
                </Box>
              </Box>
            </Box>
            <Box style={{ flexGrow: 1, gap: 8 }}>
              <Box style={{
                backgroundColor: '#4f46e5', borderRadius: 8, padding: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              }}>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{'style={}'}</Text>
                <Box style={{ backgroundColor: '#818cf8', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'badge'}</Text>
                </Box>
              </Box>
            </Box>
          </Row>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
