import React from 'react';
import { Box, Text, useScale, Typography, classifiers as S} from '../../../packages/core/src';
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

  return (
    <>
      <StorySection index={1} title="Scaled text basics">
        <S.CenterW100 tooltip={{ content: `Why This Changes\n${scaleFormula(24, scale)}\nScaled from viewport size (reference: 800x600).`, type: 'anchor', anchor: 'top', layout: 'descriptive' }}>
          <S.BoldText style={{ fontSize: 24 }}>
            {`Bold ${sz(24, scale)}`}
          </S.BoldText>
        </S.CenterW100>

        <S.CenterW100 tooltip={{ content: `Why This Changes\n${scaleFormula(16, scale)}\nScaled from viewport size (reference: 800x600).`, type: 'anchor', anchor: 'top', layout: 'descriptive' }}>
          <Text style={{ color: c.textSecondary, fontSize: 16 }}>
            {`Regular ${sz(16, scale)} gray`}
          </Text>
        </S.CenterW100>

        <S.CenterW100 tooltip={{ content: `Why This Changes\n${scaleFormula(2, scale)}\nScaled from viewport size (reference: 800x600).`, type: 'anchor', anchor: 'top', layout: 'descriptive' }}>
          <Text style={{ color: c.primary, fontSize: 14, letterSpacing: 2 }}>
            {`Letter spacing ${sz(2, scale)}`}
          </Text>
        </S.CenterW100>

        <S.CenterW100 tooltip={{ content: `Why This Changes\n${scaleFormula(28, scale)}\nScaled from viewport size (reference: 800x600).`, type: 'anchor', anchor: 'top', layout: 'descriptive' }}>
          <Text style={{ color: c.warning, fontSize: 14, lineHeight: 28 }}>
            {`Line height ${sz(28, scale)} shows extra spacing when text wraps to multiple lines.`}
          </Text>
        </S.CenterW100>

        <Box style={{
          width: 260,
          gap: 4,
        }}>
          // rjit-ignore-next-line
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'left' }}>
            Left aligned
          </Text>
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>
            Center aligned
          </Text>
          // rjit-ignore-next-line
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'right' }}>
            Right aligned
          </Text>
        </Box>

        <Text style={{ color: [0.2, 0.8, 0.4, 1], fontSize: 16 }}>
          Love2D RGBA green
        </Text>
      </StorySection>

      <StorySection index={2} title="Typography presets">
        <S.StackG8W100>
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
        </S.StackG8W100>
      </StorySection>

      <StorySection index={3} title="Emphasis and decoration">
        <S.StackG8W100>
          <S.SurfaceR6 style={{ width: 280, padding: 8, gap: 6 }}>
            <S.StoryMuted>Typography wrappers</S.StoryMuted>
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
          </S.SurfaceR6>

          <S.SurfaceR6 style={{ width: 280, padding: 8, gap: 6 }}>
            <S.StoryMuted>Raw textDecorationLine combinations</S.StoryMuted>
            <Text style={{ color: c.warning, fontSize: 16, fontWeight: 'bold', textDecorationLine: 'underline' }}>
              Bold + underline
            </Text>
            <Text style={{ color: c.error, fontSize: 14, fontWeight: 'bold', textDecorationLine: 'line-through' }}>
              Bold + strikethrough
            </Text>
            <S.StoryBody style={{ textDecorationLine: 'underline' }}>
              Small underlined (10px)
            </S.StoryBody>
            <Text style={{ color: c.text, fontSize: 20, textDecorationLine: 'underline' }}>
              Large underlined (20px)
            </Text>
          </S.SurfaceR6>
        </S.StackG8W100>
      </StorySection>

      <StorySection index={4} title="Text truncation">
        <S.SurfaceR6 style={{ width: 260, padding: 8 }}>
          <S.StoryMuted>numberOfLines: 1</S.StoryMuted>
          <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>
            {LONG_TEXT}
          </Text>
        </S.SurfaceR6>

        <S.SurfaceR6 style={{ width: 260, padding: 8 }}>
          <S.StoryMuted>numberOfLines: 2</S.StoryMuted>
          <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={2}>
            {LONG_TEXT}
          </Text>
        </S.SurfaceR6>

        <S.SurfaceR6 style={{ width: 260, padding: 8 }}>
          <S.StoryMuted>No limit</S.StoryMuted>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {LONG_TEXT}
          </Text>
        </S.SurfaceR6>
      </StorySection>
    </>
  );
}
