/**
 * TextStory — Typography reference.
 *
 * Font size scale, weight, decoration, alignment, letter spacing, line height.
 * Plus the TextEffect showcase.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';
import { TextEffectsStory } from './TextEffectsStory';

// ── Story ───────────────────────────────────────────────────────────

export function TextStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Text'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Typography. Font size, weight, decoration, alignment, spacing.'}
      </Text>

      {/* ──────────────────── 1. Font Size ──────────────────────────── */}
      <StorySection index={1} title="Font Size">
        <StyleDemo properties={[{
          property: 'fontSize',
          ways: ways([
            ['style={}', 'fontSize: 14'],
            ['shorthand', '<Text size={14}>'],
            ['scale', 'xs=12  sm=14  base=16  lg=18  xl=20  2xl=24'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{'12px (xs)'}</Text>
            <Text style={{ color: c.text, fontSize: 14, textAlign: 'center' }}>{'14px (sm)'}</Text>
            <Text style={{ color: c.text, fontSize: 16, textAlign: 'center' }}>{'16px (base)'}</Text>
            <Text style={{ color: c.text, fontSize: 20, textAlign: 'center' }}>{'20px (xl)'}</Text>
            <Text style={{ color: c.text, fontSize: 24, textAlign: 'center' }}>{'24px (2xl)'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 2. Font Weight ────────────────────────── */}
      <StorySection index={2} title="Font Weight">
        <StyleDemo properties={[{
          property: 'fontWeight',
          ways: ways([
            ['style={}', 'fontWeight: "bold"  or  fontWeight: 700'],
            ['shorthand', '<Text bold>'],
            ['scale', 'thin=100  light=300  normal  medium=500  semibold=600  bold  black=900'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'normal', textAlign: 'center' }}>{'font-normal'}</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>{'font-bold'}</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 900, textAlign: 'center' }}>{'font-black (900)'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Decoration + Alignment ─────────────── */}
      <StorySection index={3} title="Decoration and Alignment">
        <StyleDemo properties={[{
          property: 'textDecorationLine',
          ways: ways([
            ['style={}', 'textDecorationLine: "underline"'],
            ['values', '"underline"  "line-through"'],
          ]),
        }, {
          property: 'textAlign',
          ways: ways([
            ['style={}', 'textAlign: "center"'],
            ['shorthand', '<Text align="center">'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' }}>
            <Text style={{ color: c.text, fontSize: 12, textDecorationLine: 'underline', textAlign: 'center' }}>{'underline'}</Text>
            <Text style={{ color: c.text, fontSize: 12, textDecorationLine: 'line-through', textAlign: 'center' }}>{'line-through'}</Text>
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center', flexGrow: 1 }}>{'text-center'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 4. Letter Spacing + Line Height ────── */}
      <StorySection index={4} title="Letter Spacing and Line Height">
        <StyleDemo properties={[{
          property: 'letterSpacing',
          ways: ways([
            ['style={}', 'letterSpacing: 2'],
            ['scale', 'tighter=-0.8  tight=-0.4  normal=0  wide=0.4  wider=0.8  widest=1.6'],
          ]),
        }, {
          property: 'lineHeight',
          ways: ways([
            ['style={}', 'lineHeight: 28'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: c.primary, fontSize: 12, letterSpacing: 2, textAlign: 'center' }}>{'Letter spacing: 2 (tracking-wide)'}</Text>
            <Text style={{ color: c.text, fontSize: 12, lineHeight: 28, textAlign: 'center' }}>{'Line height: 28'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 5. Text Effects ───────────────────────── */}
      <TextEffectsStory index={5} />
    </StoryPage>
  );
}
