import React from 'react';
import { Box, Text, ChartTooltip, useScale } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

/** Show the actual rendered size: original × scale */
function sz(base: number, scale: number): string {
  return scale === 1 ? `${base}px` : `${Math.round(base * scale)}px (${base}×${scale.toFixed(1)})`;
}

function scaleFormula(base: number, scale: number): string {
  return `${base} × ${scale.toFixed(2)} = ${Math.round(base * scale)}px`;
}

const LONG_TEXT = 'The quick brown fox jumps over the lazy dog. This sentence is deliberately long to test how text truncation works across both renderers.';

export function TextStylesStory() {
  const c = useThemeColors();
  const scale = useScale();
  const [activeScaleTip, setActiveScaleTip] = React.useState<'font24' | 'font16' | 'letter2' | 'line28' | null>(null);

  return (
    <Box style={{
      width: '100%',
      padding: 16,
      alignItems: 'center',
    }}>
      <Box style={{ width: '100%', maxWidth: 460, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Text styles</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
          gap: 8,
          alignItems: 'center',
        }}>
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
            padding: 8,
            backgroundColor: c.surface,
            borderRadius: 6,
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
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Text truncation</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
          gap: 8,
          alignItems: 'center',
        }}>
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
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>3. Text decoration</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ width: 280, backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 6 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>textDecorationLine</Text>
            <Text style={{ color: c.text, fontSize: 15, textDecorationLine: 'underline' }}>
              Underlined text
            </Text>
            <Text style={{ color: c.primary, fontSize: 14, textDecorationLine: 'line-through' }}>
              Strikethrough text
            </Text>
            <Text style={{ color: c.success, fontSize: 14, textDecorationLine: 'none' }}>
              Explicit none
            </Text>
          </Box>

          <Box style={{ width: 280, backgroundColor: c.surface, borderRadius: 6, padding: 8, gap: 6 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Decoration + weight + size</Text>
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
      </Box>
    </Box>
  );
}
