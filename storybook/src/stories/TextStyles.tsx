import React from 'react';
import { Box, Text, ChartTooltip, useScale, Typography } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StorySection } from './_shared/StoryScaffold';

/** Show the actual rendered size: original × scale */
function sz(base: number, scale: number): string {
  return scale === 1 ? `${base}px` : `${Math.round(base * scale)}px (${base}x${scale.toFixed(1)})`;
}

function scaleFormula(base: number, scale: number): string {
  return `${base} x ${scale.toFixed(2)} = ${Math.round(base * scale)}px`;
}

const LONG_TEXT = 'The quick brown fox jumps over the lazy dog. This sentence is deliberately long to test how text truncation works across both renderers.';

export function TextStylesStory() {
  const c = useThemeColors();
  const scale = useScale();
  const [activeScaleTip, setActiveScaleTip] = React.useState<'font24' | 'font16' | 'letter2' | 'line28' | null>(null);

  return (
    <>
      <StorySection index={1} title="Scaled text basics">
        <Box
          onPointerEnter={() => setActiveScaleTip('font24')}
          onPointerLeave={() => setActiveScaleTip(prev => (prev === 'font24' ? null : prev))}
          style={{ width: '100%', position: 'relative', alignItems: 'center' }}
        >
          <ChartTooltip visible={activeScaleTip === 'font24'} anchor="top">
            <ChartTooltip.Label>Why This Changes</ChartTooltip.Label>
            <ChartTooltip.Value>{scaleFormula(24, scale)}</ChartTooltip.Value>
            <ChartTooltip.Detail>Scaled from viewport size (reference: 800×600).</ChartTooltip.Detail>
          </ChartTooltip>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>
            {`Bold ${sz(24, scale)}`}
          </Text>
        </Box>

        <Box
          onPointerEnter={() => setActiveScaleTip('font16')}
          onPointerLeave={() => setActiveScaleTip(prev => (prev === 'font16' ? null : prev))}
          style={{ width: '100%', position: 'relative', alignItems: 'center' }}
        >
          <ChartTooltip visible={activeScaleTip === 'font16'} anchor="top">
            <ChartTooltip.Label>Why This Changes</ChartTooltip.Label>
            <ChartTooltip.Value>{scaleFormula(16, scale)}</ChartTooltip.Value>
            <ChartTooltip.Detail>Scaled from viewport size (reference: 800×600).</ChartTooltip.Detail>
          </ChartTooltip>
          <Text style={{ color: c.textSecondary, fontSize: 16 }}>
            {`Regular ${sz(16, scale)} gray`}
          </Text>
        </Box>

        <Box
          onPointerEnter={() => setActiveScaleTip('letter2')}
          onPointerLeave={() => setActiveScaleTip(prev => (prev === 'letter2' ? null : prev))}
          style={{ width: '100%', position: 'relative', alignItems: 'center' }}
        >
          <ChartTooltip visible={activeScaleTip === 'letter2'} anchor="top">
            <ChartTooltip.Label>Why This Changes</ChartTooltip.Label>
            <ChartTooltip.Value>{scaleFormula(2, scale)}</ChartTooltip.Value>
            <ChartTooltip.Detail>Scaled from viewport size (reference: 800×600).</ChartTooltip.Detail>
          </ChartTooltip>
          <Text style={{ color: c.primary, fontSize: 14, letterSpacing: 2 }}>
            {`Letter spacing ${sz(2, scale)}`}
          </Text>
        </Box>

        <Box
          onPointerEnter={() => setActiveScaleTip('line28')}
          onPointerLeave={() => setActiveScaleTip(prev => (prev === 'line28' ? null : prev))}
          style={{ width: '100%', position: 'relative', alignItems: 'center' }}
        >
          <ChartTooltip visible={activeScaleTip === 'line28'} anchor="top">
            <ChartTooltip.Label>Why This Changes</ChartTooltip.Label>
            <ChartTooltip.Value>{scaleFormula(28, scale)}</ChartTooltip.Value>
            <ChartTooltip.Detail>Scaled from viewport size (reference: 800×600).</ChartTooltip.Detail>
          </ChartTooltip>
          <Text style={{ color: c.warning, fontSize: 14, lineHeight: 28 }}>
            {`Line height ${sz(28, scale)} shows extra spacing when text wraps to multiple lines.`}
          </Text>
        </Box>

        <Box style={{
          width: 260,
          gap: 4,
        }}>
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'left' }}>
            Left aligned
          </Text>
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>
            Center aligned
          </Text>
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>
            Right aligned
          </Text>
        </Box>

        <Text style={{ color: [0.2, 0.8, 0.4, 1], fontSize: 16 }}>
          Love2D RGBA green
        </Text>
      </StorySection>

      <StorySection index={2} title="Typography presets">
        <Box style={{ width: '100%', gap: 8 }}>
          <Typography.Heading style={{ color: c.text, fontSize: 24 }}>
            The quick brown fox jumps over the lazy dog
          </Typography.Heading>
          <Typography.SubHeading style={{ color: c.primary, fontSize: 18 }}>
            Secondary heading: all things in motion
          </Typography.SubHeading>
          <Typography.Label style={{ color: c.primary, fontSize: 12 }}>
            LABEL TEXT
          </Typography.Label>
          <Typography.Caption style={{ color: c.textDim, fontSize: 10 }}>
            Small caption: supporting details at the margins
          </Typography.Caption>
          <Typography.Muted style={{ color: c.text, fontSize: 13 }}>
            Muted content: secondary, steps back into the background
          </Typography.Muted>
          <Typography.Mono style={{ color: c.text, fontSize: 13 }}>
            Monospace: const x = "code";
          </Typography.Mono>
        </Box>
      </StorySection>

      <StorySection index={3} title="Emphasis and decoration">
        <Box style={{ width: '100%', gap: 8 }}>
          <Box style={{ width: 280, backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 6 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Typography wrappers</Text>
            <Typography.Bold style={{ color: c.text, fontSize: 16 }}>
              Bold text stands out
            </Typography.Bold>
            <Typography.Italic style={{ color: c.text, fontSize: 16 }}>
              Italic text leans
            </Typography.Italic>
            <Typography.Underline style={{ color: c.text, fontSize: 16 }}>
              Underlined emphasizes
            </Typography.Underline>
            <Typography.Strike style={{ color: c.textDim, fontSize: 16 }}>
              Strikethrough removes
            </Typography.Strike>
          </Box>

          <Box style={{ width: 280, backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 6 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Raw textDecorationLine combinations</Text>
            <Text style={{ color: c.warning, fontSize: 16, fontWeight: 'bold', textDecorationLine: 'underline' }}>
              Bold + underline
            </Text>
            <Text style={{ color: c.error, fontSize: 14, fontWeight: 'bold', textDecorationLine: 'line-through' }}>
              Bold + strikethrough
            </Text>
            <Text style={{ color: c.text, fontSize: 10, textDecorationLine: 'underline' }}>
              Small underlined (10px)
            </Text>
            <Text style={{ color: c.text, fontSize: 20, textDecorationLine: 'underline' }}>
              Large underlined (20px)
            </Text>
          </Box>
        </Box>
      </StorySection>

      <StorySection index={4} title="Text truncation">
        <Box style={{ width: 260, backgroundColor: c.surface, padding: 8, borderRadius: 6 }}>
          <Text style={{ color: c.textDim, fontSize: 10 }}>numberOfLines: 1</Text>
          <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>
            {LONG_TEXT}
          </Text>
        </Box>

        <Box style={{ width: 260, backgroundColor: c.surface, padding: 8, borderRadius: 6 }}>
          <Text style={{ color: c.textDim, fontSize: 10 }}>numberOfLines: 2</Text>
          <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={2}>
            {LONG_TEXT}
          </Text>
        </Box>

        <Box style={{ width: 260, backgroundColor: c.surface, padding: 8, borderRadius: 6 }}>
          <Text style={{ color: c.textDim, fontSize: 10 }}>No limit</Text>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {LONG_TEXT}
          </Text>
        </Box>
      </StorySection>
    </>
  );
}
