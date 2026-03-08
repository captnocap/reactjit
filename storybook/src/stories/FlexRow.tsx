import React, { useState } from 'react';
import { Box, Text, Pressable, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const ROW_COLORS = ['#ef4444', '#f97316', '#eab308'];
const WRAP_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

function Chip({ label, color, size = 42 }: { label: string; color: string; size?: number }) {
  return (
    <Box style={{
      width: size,
      height: size,
      backgroundColor: color,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <S.WhiteBody>{label}</S.WhiteBody>
    </Box>
  );
}

function Bar({ label, width, color }: { label: string; width: number; color: string }) {
  return (
    <Box style={{
      width,
      height: 26,
      backgroundColor: color,
      borderRadius: 5,
      justifyContent: 'center',
      paddingLeft: 8,
      paddingRight: 8,
    }}>
      <S.WhiteBody>{label}</S.WhiteBody>
    </Box>
  );
}

export function FlexRowStory() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [toggled, setToggled] = useState(false);

  return (
    <StoryPage>
        <StorySection index={1} title="Row layout (`justifyContent`)">
          <S.StoryMuted>
            Row boxes need explicit width for `justifyContent` to distribute children.
          </S.StoryMuted>
          {(['start', 'center', 'end', 'space-between', 'space-around'] as const).map(justify => (
            <Box key={justify} style={{ gap: 4 }}>
              <S.SecondaryBody>{`justify: ${justify}`}</S.SecondaryBody>
              <Box style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: justify,
                backgroundColor: c.surface,
                borderRadius: 6,
                padding: 6,
              }}>
                <Chip label="A" color={ROW_COLORS[0]} />
                <Chip label="B" color={ROW_COLORS[1]} />
                <Chip label="C" color={ROW_COLORS[2]} />
              </Box>
            </Box>
          ))}
        </StorySection>

        <StorySection index={2} title="Column layout (`alignItems`)">
          <S.StackG10W100 style={{ flexDirection: 'row' }}>
            {(['start', 'center', 'end'] as const).map((align, i) => (
              <Box
                key={align}
                style={{
                  flexGrow: 1,
                  height: 150,
                  backgroundColor: c.surface,
                  borderRadius: 6,
                  padding: 8,
                  gap: 6,
                  alignItems: align,
                }}
              >
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>{`align: ${align}`}</Text>
                <Bar label="Short" width={52} color={WRAP_COLORS[i * 3]} />
                <Bar label="Medium" width={74} color={WRAP_COLORS[i * 3 + 1]} />
                <Bar label="Long Label" width={98} color={WRAP_COLORS[i * 3 + 2]} />
              </Box>
            ))}
          </S.StackG10W100>
        </StorySection>

        <StorySection index={3} title="Wrapping (`flexWrap`)">
          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Fixed-size items + gap</S.SecondaryBody>
            <S.RowG6 style={{ flexWrap: 'wrap', backgroundColor: c.surface, borderRadius: 6, padding: 8 }}>
              {WRAP_COLORS.map((color, i) => (
                <Chip key={i} label={`${i + 1}`} color={color} size={36} />
              ))}
            </S.RowG6>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Wrapping rows with `flexBasis` + `flexGrow`</S.SecondaryBody>
            <S.RowG6 style={{ flexWrap: 'wrap', backgroundColor: c.surface, borderRadius: 6, padding: 8 }}>
              {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((name, i) => (
                <Box
                  key={name}
                  style={{
                    flexBasis: 110,
                    flexGrow: 1,
                    height: 30,
                    backgroundColor: WRAP_COLORS[i],
                    borderRadius: 5,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <S.WhiteBody>{name}</S.WhiteBody>
                </Box>
              ))}
            </S.RowG6>
          </Box>
        </StorySection>

        <StorySection index={4} title="Spacing (`padding` + `margin`)">
          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Uniform `padding: 20`</S.SecondaryBody>
            <S.SurfaceR6 style={{ padding: 20 }}>
              <S.Center style={{ backgroundColor: c.primary, borderRadius: 5, height: 30 }}>
                <S.WhiteBody>Content</S.WhiteBody>
              </S.Center>
            </S.SurfaceR6>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Per-side padding (`left: 40`, `top: 8`)</S.SecondaryBody>
            <S.SurfaceR6 style={{ paddingLeft: 40, paddingTop: 8, paddingRight: 8, paddingBottom: 8 }}>
              <S.Center style={{ backgroundColor: c.success, borderRadius: 5, height: 30 }}>
                <S.WhiteBody>Offset left</S.WhiteBody>
              </S.Center>
            </S.SurfaceR6>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Sibling spacing with `marginLeft`</S.SecondaryBody>
            <S.SurfaceR6 style={{ padding: 8, flexDirection: 'row' }}>
              <Box style={{ width: 36, height: 36, backgroundColor: '#ef4444', borderRadius: 5 }} />
              <Box style={{ width: 36, height: 36, backgroundColor: '#f97316', borderRadius: 5, marginLeft: 20 }} />
              <Box style={{ width: 36, height: 36, backgroundColor: '#eab308', borderRadius: 5, marginLeft: 8 }} />
            </S.SurfaceR6>
          </Box>
        </StorySection>

        <StorySection index={5} title="Flex shrink (`flexShrink`)">
          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Default shrink (items wider than container)</S.SecondaryBody>
            <S.RowG4 style={{ width: 250, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <S.Center style={{ width: 120, height: 36, backgroundColor: '#ef4444', borderRadius: 5 }}>
                <S.WhiteBody>120px</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, backgroundColor: '#f97316', borderRadius: 5 }}>
                <S.WhiteBody>120px</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, backgroundColor: '#eab308', borderRadius: 5 }}>
                <S.WhiteBody>120px</S.WhiteBody>
              </S.Center>
            </S.RowG4>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>First item `flexShrink: 0` (won't shrink)</S.SecondaryBody>
            <S.RowG4 style={{ width: 250, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <S.Center style={{ width: 120, height: 36, flexShrink: 0, backgroundColor: '#3b82f6', borderRadius: 5 }}>
                <S.WhiteBody>No shrink</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, backgroundColor: '#6366f1', borderRadius: 5 }}>
                <S.WhiteBody>Shrinks</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, backgroundColor: '#8b5cf6', borderRadius: 5 }}>
                <S.WhiteBody>Shrinks</S.WhiteBody>
              </S.Center>
            </S.RowG4>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Shrink ratios: `1 / 2 / 3`</S.SecondaryBody>
            <S.RowG4 style={{ width: 220, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <S.Center style={{ width: 120, height: 36, flexShrink: 1, backgroundColor: '#22c55e', borderRadius: 5 }}>
                <S.WhiteBody>1x</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, flexShrink: 2, backgroundColor: '#14b8a6', borderRadius: 5 }}>
                <S.WhiteBody>2x</S.WhiteBody>
              </S.Center>
              <S.Center style={{ width: 120, height: 36, flexShrink: 3, backgroundColor: '#06b6d4', borderRadius: 5 }}>
                <S.WhiteBody>3x</S.WhiteBody>
              </S.Center>
            </S.RowG4>
          </Box>
        </StorySection>

        <StorySection index={6} title="Aspect ratio (`aspectRatio`)">
          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Square from width: `width: 80, aspectRatio: 1`</S.SecondaryBody>
            <S.Center style={{ width: 80, aspectRatio: 1, backgroundColor: '#ef4444', borderRadius: 5 }}>
              <S.WhiteBody>80x80</S.WhiteBody>
            </S.Center>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Video card from width: `240, aspectRatio: 16/9`</S.SecondaryBody>
            <Box style={{ width: 240, aspectRatio: 16 / 9, backgroundColor: '#3b82f6', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
              <S.WhiteBody>240x135</S.WhiteBody>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Width derived from height: `height: 50, aspectRatio: 2`</S.SecondaryBody>
            <S.Center style={{ height: 50, aspectRatio: 2, backgroundColor: '#22c55e', borderRadius: 5 }}>
              <S.WhiteBody>100x50</S.WhiteBody>
            </S.Center>
          </Box>

          <Box style={{ gap: 4 }}>
            <S.SecondaryBody>Row ratios: `1:1`, `2:1`, `3:1` (fixed height)</S.SecondaryBody>
            <S.RowG8>
              <Box style={{ height: 34, aspectRatio: 1, backgroundColor: '#a855f7', borderRadius: 5 }} />
              <Box style={{ height: 34, aspectRatio: 2, backgroundColor: '#d946ef', borderRadius: 5 }} />
              <Box style={{ height: 34, aspectRatio: 3, backgroundColor: '#ec4899', borderRadius: 5 }} />
            </S.RowG8>
          </Box>
        </StorySection>

        <StorySection index={8} title="Spring Layout Animation">
          <S.RowWrap style={{ width: '100%', justifyContent: 'center', gap: 12 }}>
            <Box style={{ width: 320, backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 10, alignItems: 'center' }}>
              <S.SecondaryBody>Width spring</S.SecondaryBody>
              <Pressable
                onPress={() => setExpanded(v => !v)}
                style={{ backgroundColor: c.primary, padding: 10, borderRadius: 6, alignItems: 'center', width: 120 }}
              >
                <S.WhiteMedText>{expanded ? 'Collapse' : 'Expand'}</S.WhiteMedText>
              </Pressable>
              <Box style={{
                width: expanded ? 260 : 80,
                height: 50,
                backgroundColor: c.accent,
                borderRadius: 6,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                transition: {
                  width: { duration: 600, easing: 'spring' },
                },
              }}>
                <S.WhiteMedText>{expanded ? '260px' : '80px'}</S.WhiteMedText>
              </Box>
            </Box>

            <Box style={{ width: 320, backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 10, alignItems: 'center' }}>
              <S.SecondaryBody>Position spring</S.SecondaryBody>
              <Pressable
                onPress={() => setToggled(v => !v)}
                style={{ backgroundColor: c.success, padding: 10, borderRadius: 6, alignItems: 'center', width: 120 }}
              >
                <S.WhiteMedText>Toggle</S.WhiteMedText>
              </Pressable>
              <Box style={{
                width: 60, height: 60,
                backgroundColor: '#ef4444',
                borderRadius: 30,
                transform: {
                  translateX: toggled ? 160 : 0,
                  scaleX: toggled ? 1.2 : 1,
                  scaleY: toggled ? 1.2 : 1,
                },
                justifyContent: 'center',
                alignItems: 'center',
                transition: {
                  transform: { duration: 600, easing: 'spring' },
                },
              }}>
                <S.WhiteBody>{toggled ? '160' : '0'}</S.WhiteBody>
              </Box>
              <Box style={{ padding: 8, backgroundColor: c.bgElevated, borderRadius: 4, gap: 2 }}>
                <S.StoryMuted>{`translateX: ${toggled ? 160 : 0}px`}</S.StoryMuted>
                <S.StoryMuted>{`scale: ${toggled ? '1.20' : '1.00'}`}</S.StoryMuted>
              </Box>
            </Box>
          </S.RowWrap>
        </StorySection>
    </StoryPage>
  );
}
