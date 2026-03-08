import React from 'react';
import { Box, Text, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

export function GradientStory() {
  const c = useThemeColors();
  return (
    <StoryPage>
        <StorySection index={1} title="Gradients">
          <S.RowG8 style={{ width: '100%' }}>
            <Box style={{
              flexGrow: 1,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Horizontal</Text>
            </Box>
            <Box style={{
              flexGrow: 1,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'vertical', colors: ['#f97316', '#ef4444'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Vertical</Text>
            </Box>
            <Box style={{
              flexGrow: 1,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'diagonal', colors: ['#22c55e', '#06b6d4'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Diagonal</Text>
            </Box>
            <Box style={{
              flexGrow: 1,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'horizontal', colors: [[1, 0.8, 0, 1], [1, 0, 0.4, 1]] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>RGBA Colors</Text>
            </Box>
          </S.RowG8>
        </StorySection>

        <StorySection index={2} title="Box shadow">
          <S.RowWrap style={{ gap: 12, justifyContent: 'center' }}>
            <S.Center style={{ width: 150, height: 56, borderRadius: 8, backgroundColor: c.surface, shadowColor: c.primary, shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 12 }}>
              <S.StoryBody>Blue glow</S.StoryBody>
            </S.Center>
            <S.Center style={{ width: 150, height: 56, borderRadius: 8, backgroundColor: c.surface, shadowColor: '#000000', shadowOffsetX: 4, shadowOffsetY: 4, shadowBlur: 8 }}>
              <S.StoryBody>Drop shadow</S.StoryBody>
            </S.Center>
            <S.Center style={{ width: 150, height: 56, borderRadius: 8, backgroundColor: c.surface, shadowColor: c.error, shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 20 }}>
              <S.StoryBody>Red halo</S.StoryBody>
            </S.Center>
          </S.RowWrap>
        </StorySection>

        <StorySection index={3} title="Border radius">
          <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {[0, 4, 8, 16, 24, 50].map(r => (
              <Box key={r} style={{
                width: 58,
                height: 58,
                borderRadius: r,
                backgroundColor: c.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <S.WhiteBody>{`${r}`}</S.WhiteBody>
              </Box>
            ))}
          </S.RowG8>
          <S.RowCenterG8 style={{ justifyContent: 'center' }}>
            <S.Center style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.accent }}>
              <S.WhiteBody>Circle</S.WhiteBody>
            </S.Center>
            <S.Center style={{ width: 100, height: 44, borderRadius: 14, backgroundColor: c.surface, borderWidth: 2, borderColor: c.success }}>
              <Text style={{ color: c.success, fontSize: 10 }}>Border + Radius</Text>
            </S.Center>
          </S.RowCenterG8>
        </StorySection>

        <StorySection index={4} title="Transforms">
          <S.RowCenter style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <S.SecondaryBody style={{ width: 62 }}>rotate</S.SecondaryBody>
            {[0, 15, 45, 90].map(deg => (
              <Box key={deg} style={{
                width: 44,
                height: 44,
                borderRadius: 6,
                backgroundColor: '#3b82f6',
                transform: { rotate: deg },
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <S.WhiteCaption>{`${deg}`}</S.WhiteCaption>
              </Box>
            ))}
          </S.RowCenter>
          <S.RowCenter style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <S.SecondaryBody style={{ width: 62 }}>scale</S.SecondaryBody>
            {[0.5, 0.75, 1.0, 1.25].map(s => (
              <Box key={s} style={{
                width: 44,
                height: 44,
                borderRadius: 6,
                backgroundColor: '#22c55e',
                transform: { scaleX: s, scaleY: s },
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <S.WhiteCaption>{`${s}x`}</S.WhiteCaption>
              </Box>
            ))}
          </S.RowCenter>
          <S.RowCenter style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <S.SecondaryBody style={{ width: 62 }}>translate</S.SecondaryBody>
            <Box style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              backgroundColor: '#ef4444',
              transform: { translateX: 8, translateY: -5 },
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <S.WhiteTiny>8,-5</S.WhiteTiny>
            </Box>
            <Box style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              backgroundColor: '#f97316',
              transform: { translateX: 0, translateY: 10 },
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <S.WhiteTiny>0,10</S.WhiteTiny>
            </Box>
            <Box style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              backgroundColor: '#8b5cf6',
              transform: { rotate: 30, scaleX: 1.15, scaleY: 1.15, translateX: 4 },
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <S.WhiteTiny>all</S.WhiteTiny>
            </Box>
          </S.RowCenter>
        </StorySection>

        <StorySection index={5} title="Opacity">
          <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {[1.0, 0.75, 0.5, 0.25, 0.1].map(op => (
              <Box key={op} style={{
                width: 46,
                height: 46,
                borderRadius: 6,
                backgroundColor: c.primary,
                opacity: op,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <S.WhiteCaption>{`${op}`}</S.WhiteCaption>
              </Box>
            ))}
          </S.RowG8>
          <Box style={{
            opacity: 0.8,
            backgroundColor: '#ef4444',
            borderRadius: 6,
            padding: 8,
          }}>
            <S.WhiteBody>Parent: 0.8</S.WhiteBody>
            <Box style={{
              marginTop: 4,
              opacity: 0.5,
              backgroundColor: '#f97316',
              borderRadius: 6,
              padding: 8,
            }}>
              <S.WhiteBody>Child: 0.5 (effective 0.4)</S.WhiteBody>
            </Box>
          </Box>
        </StorySection>

        <StorySection index={6} title="Z-index">
          <S.SecondaryBody style={{ textAlign: 'center' }}>Overlapping cards; blue (`z:3`) should be on top.</S.SecondaryBody>
          <Box style={{ width: 180, height: 120, position: 'relative' }}>
            <S.Center style={{ position: 'absolute', top: 0, left: 0, width: 84, height: 84, borderRadius: 8, backgroundColor: '#ef4444', zIndex: 1 }}>
              <S.WhiteBody>z:1</S.WhiteBody>
            </S.Center>
            <S.Center style={{ position: 'absolute', top: 18, left: 30, width: 84, height: 84, borderRadius: 8, backgroundColor: '#3b82f6', zIndex: 3 }}>
              <S.WhiteBody>z:3</S.WhiteBody>
            </S.Center>
            <S.Center style={{ position: 'absolute', top: 36, left: 60, width: 84, height: 84, borderRadius: 8, backgroundColor: '#22c55e', zIndex: 2 }}>
              <S.WhiteBody>z:2</S.WhiteBody>
            </S.Center>
          </Box>
        </StorySection>

        <StorySection index={7} title="Per-side borders">
          <S.CenterG4>
            <S.SecondaryBody>Individual sides</S.SecondaryBody>
            <S.RowG8 style={{ justifyContent: 'center' }}>
              <S.Center style={{ width: 68, height: 68, backgroundColor: c.bg, borderTopWidth: 3, borderColor: c.error }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top</Text>
              </S.Center>
              <S.Center style={{ width: 68, height: 68, backgroundColor: c.bg, borderRightWidth: 3, borderColor: c.primary }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Right</Text>
              </S.Center>
              <S.Center style={{ width: 68, height: 68, backgroundColor: c.bg, borderBottomWidth: 3, borderColor: c.success }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Bottom</Text>
              </S.Center>
              <S.Center style={{ width: 68, height: 68, backgroundColor: c.bg, borderLeftWidth: 3, borderColor: c.warning }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Left</Text>
              </S.Center>
            </S.RowG8>
          </S.CenterG4>

          <S.CenterG4>
            <S.SecondaryBody>Combinations</S.SecondaryBody>
            <S.RowG8 style={{ justifyContent: 'center' }}>
              <S.Center style={{ width: 80, height: 58, backgroundColor: c.bg, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#a855f7' }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>Top+Bottom</Text>
              </S.Center>
              <S.Center style={{ width: 80, height: 58, backgroundColor: c.bg, borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#ec4899' }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>Left+Right</Text>
              </S.Center>
              <S.Center style={{ width: 80, height: 58, backgroundColor: c.bg, borderLeftWidth: 3, borderBottomWidth: 1, borderColor: c.info }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>L thick+B thin</Text>
              </S.Center>
            </S.RowG8>
          </S.CenterG4>

          <S.CenterG4>
            <S.SecondaryBody>Mixed widths (`1 / 2 / 4 / 6`)</S.SecondaryBody>
            <S.Center style={{ width: 150, height: 80, backgroundColor: c.bg, borderTopWidth: 1, borderRightWidth: 2, borderBottomWidth: 4, borderLeftWidth: 6, borderColor: c.text }}>
              <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top/Right/Bottom/Left</Text>
            </S.Center>
          </S.CenterG4>
        </StorySection>
    </StoryPage>
  );
}
