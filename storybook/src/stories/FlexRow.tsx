import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { FlexRowStory as CoreFlexRowStory } from '../../../packages/components/src/FlexRow/FlexRow.story';
import { FlexColumnStory as CoreFlexColumnStory } from '../../../packages/components/src/FlexColumn/FlexColumn.story';

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
      <Text style={{ color: '#fff', fontSize: 10 }}>{label}</Text>
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
      <Text style={{ color: '#fff', fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

export function FlexRowStory() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [toggled, setToggled] = useState(false);

  return (
    <Box style={{ width: '100%', padding: 16, alignItems: 'center' }}>
      <Box style={{ width: '100%', maxWidth: 760, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Row layout (`justifyContent`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Row boxes need explicit width for `justifyContent` to distribute children.
          </Text>
          {(['start', 'center', 'end', 'space-between', 'space-around'] as const).map(justify => (
            <Box key={justify} style={{ gap: 4 }}>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>{`justify: ${justify}`}</Text>
              <Box style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: justify,
                gap: 6,
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
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Column layout (`alignItems`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Box style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
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
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>3. Wrapping (`flexWrap`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Fixed-size items + gap</Text>
            <Box style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 8,
            }}>
              {WRAP_COLORS.map((color, i) => (
                <Chip key={i} label={`${i + 1}`} color={color} size={36} />
              ))}
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Wrapping rows with `flexBasis` + `flexGrow`</Text>
            <Box style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 8,
            }}>
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
                  <Text style={{ color: '#fff', fontSize: 10 }}>{name}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>4. Spacing (`padding` + `margin`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Uniform `padding: 20`</Text>
            <Box style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 20,
            }}>
              <Box style={{
                backgroundColor: c.primary,
                borderRadius: 5,
                height: 30,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>Content</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Per-side padding (`left: 40`, `top: 8`)</Text>
            <Box style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingLeft: 40,
              paddingTop: 8,
              paddingRight: 8,
              paddingBottom: 8,
            }}>
              <Box style={{
                backgroundColor: c.success,
                borderRadius: 5,
                height: 30,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>Offset left</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Sibling spacing with `marginLeft`</Text>
            <Box style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 8,
              flexDirection: 'row',
            }}>
              <Box style={{ width: 36, height: 36, backgroundColor: '#ef4444', borderRadius: 5 }} />
              <Box style={{ width: 36, height: 36, backgroundColor: '#f97316', borderRadius: 5, marginLeft: 20 }} />
              <Box style={{ width: 36, height: 36, backgroundColor: '#eab308', borderRadius: 5, marginLeft: 8 }} />
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>5. Flex shrink (`flexShrink`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Default shrink (items wider than container)</Text>
            <Box style={{ width: 250, flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <Box style={{ width: 120, height: 36, backgroundColor: '#ef4444', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: '#f97316', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: '#eab308', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>First item `flexShrink: 0` (won't shrink)</Text>
            <Box style={{ width: 250, flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <Box style={{ width: 120, height: 36, flexShrink: 0, backgroundColor: '#3b82f6', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>No shrink</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: '#6366f1', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>Shrinks</Text>
              </Box>
              <Box style={{ width: 120, height: 36, backgroundColor: '#8b5cf6', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>Shrinks</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Shrink ratios: `1 / 2 / 3`</Text>
            <Box style={{ width: 220, flexDirection: 'row', gap: 4, backgroundColor: c.surface, borderRadius: 6, padding: 6 }}>
              <Box style={{ width: 120, height: 36, flexShrink: 1, backgroundColor: '#22c55e', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>1x</Text>
              </Box>
              <Box style={{ width: 120, height: 36, flexShrink: 2, backgroundColor: '#14b8a6', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>2x</Text>
              </Box>
              <Box style={{ width: 120, height: 36, flexShrink: 3, backgroundColor: '#06b6d4', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>3x</Text>
              </Box>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>6. Aspect ratio (`aspectRatio`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
        }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Square from width: `width: 80, aspectRatio: 1`</Text>
            <Box style={{ width: 80, aspectRatio: 1, backgroundColor: '#ef4444', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>80x80</Text>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Video card from width: `240, aspectRatio: 16/9`</Text>
            <Box style={{ width: 240, aspectRatio: 16 / 9, backgroundColor: '#3b82f6', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>240x135</Text>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Width derived from height: `height: 50, aspectRatio: 2`</Text>
            <Box style={{ height: 50, aspectRatio: 2, backgroundColor: '#22c55e', borderRadius: 5, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>100x50</Text>
            </Box>
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Row ratios: `1:1`, `2:1`, `3:1` (fixed height)</Text>
            <Box style={{ flexDirection: 'row', gap: 8 }}>
              <Box style={{ height: 34, aspectRatio: 1, backgroundColor: '#a855f7', borderRadius: 5 }} />
              <Box style={{ height: 34, aspectRatio: 2, backgroundColor: '#d946ef', borderRadius: 5 }} />
              <Box style={{ height: 34, aspectRatio: 3, backgroundColor: '#ec4899', borderRadius: 5 }} />
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>7. Core Layout Components (`FlexRow` / `FlexColumn`)</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 12,
        }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Core `FlexRow` component</Text>
            <Box style={{ backgroundColor: c.surface, borderRadius: 6 }}>
              <CoreFlexRowStory />
            </Box>
          </Box>
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Core `FlexColumn` component</Text>
            <Box style={{ backgroundColor: c.surface, borderRadius: 6 }}>
              <CoreFlexColumnStory />
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>8. Spring Layout Animation</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 12,
          alignItems: 'center',
        }}>
          <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <Box style={{ width: 320, backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 10, alignItems: 'center' }}>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>Width spring</Text>
              <Pressable
                onPress={() => setExpanded(v => !v)}
                style={{ backgroundColor: c.primary, padding: 10, borderRadius: 6, alignItems: 'center', width: 120 }}
              >
                <Text style={{ color: '#fff', fontSize: 12 }}>{expanded ? 'Collapse' : 'Expand'}</Text>
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
                  width: { duration: 320, easing: 'spring' },
                },
              }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>{expanded ? '260px' : '80px'}</Text>
              </Box>
            </Box>

            <Box style={{ width: 320, backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 10, alignItems: 'center' }}>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>Position spring</Text>
              <Pressable
                onPress={() => setToggled(v => !v)}
                style={{ backgroundColor: c.success, padding: 10, borderRadius: 6, alignItems: 'center', width: 120 }}
              >
                <Text style={{ color: '#fff', fontSize: 12 }}>Toggle</Text>
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
                  transform: { duration: 320, easing: 'spring' },
                },
              }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>{toggled ? '160' : '0'}</Text>
              </Box>
              <Box style={{ padding: 8, backgroundColor: c.bgElevated, borderRadius: 4, gap: 2 }}>
                <Text style={{ color: c.textDim, fontSize: 10 }}>{`translateX: ${toggled ? 160 : 0}px`}</Text>
                <Text style={{ color: c.textDim, fontSize: 10 }}>{`scale: ${toggled ? '1.20' : '1.00'}`}</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
