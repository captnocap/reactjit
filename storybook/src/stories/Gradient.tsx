import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

export function GradientStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', padding: 16, alignItems: 'center' }}>
      <Box style={{ width: '100%', maxWidth: 760, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Gradients</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <Box style={{
              width: 170,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Horizontal</Text>
            </Box>
            <Box style={{
              width: 170,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'vertical', colors: ['#f97316', '#ef4444'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Vertical</Text>
            </Box>
            <Box style={{
              width: 170,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'diagonal', colors: ['#22c55e', '#06b6d4'] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>Diagonal</Text>
            </Box>
            <Box style={{
              width: 170,
              height: 60,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundGradient: { direction: 'horizontal', colors: [[1, 0.8, 0, 1], [1, 0, 0.4, 1]] },
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>RGBA Colors</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Box shadow</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Box style={{
              width: 150,
              height: 56,
              borderRadius: 8,
              backgroundColor: c.surface,
              shadowColor: c.primary,
              shadowOffsetX: 0,
              shadowOffsetY: 4,
              shadowBlur: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.text, fontSize: 10 }}>Blue glow</Text>
            </Box>
            <Box style={{
              width: 150,
              height: 56,
              borderRadius: 8,
              backgroundColor: c.surface,
              shadowColor: '#000000',
              shadowOffsetX: 4,
              shadowOffsetY: 4,
              shadowBlur: 8,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.text, fontSize: 10 }}>Drop shadow</Text>
            </Box>
            <Box style={{
              width: 150,
              height: 56,
              borderRadius: 8,
              backgroundColor: c.surface,
              shadowColor: c.error,
              shadowOffsetX: 0,
              shadowOffsetY: 0,
              shadowBlur: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.text, fontSize: 10 }}>Red halo</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>3. Border radius</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[0, 4, 8, 16, 24, 50].map(r => (
              <Box key={r} style={{
                width: 58,
                height: 58,
                borderRadius: r,
                backgroundColor: c.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 10 }}>{`${r}`}</Text>
              </Box>
            ))}
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              backgroundColor: c.accent,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Circle</Text>
            </Box>
            <Box style={{
              width: 100,
              height: 44,
              borderRadius: 14,
              backgroundColor: c.surface,
              borderWidth: 2,
              borderColor: c.success,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.success, fontSize: 10 }}>Border + Radius</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>4. Transforms</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, width: 62 }}>rotate</Text>
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
                <Text style={{ color: '#fff', fontSize: 9 }}>{`${deg}`}</Text>
              </Box>
            ))}
          </Box>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, width: 62 }}>scale</Text>
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
                <Text style={{ color: '#fff', fontSize: 9 }}>{`${s}x`}</Text>
              </Box>
            ))}
          </Box>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, width: 62 }}>translate</Text>
            <Box style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              backgroundColor: '#ef4444',
              transform: { translateX: 8, translateY: -5 },
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>8,-5</Text>
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
              <Text style={{ color: '#fff', fontSize: 8 }}>0,10</Text>
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
              <Text style={{ color: '#fff', fontSize: 8 }}>all</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>5. Opacity</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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
                <Text style={{ color: '#fff', fontSize: 9 }}>{`${op}`}</Text>
              </Box>
            ))}
          </Box>
          <Box style={{
            opacity: 0.8,
            backgroundColor: '#ef4444',
            borderRadius: 6,
            padding: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>Parent: 0.8</Text>
            <Box style={{
              marginTop: 4,
              opacity: 0.5,
              backgroundColor: '#f97316',
              borderRadius: 6,
              padding: 8,
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Child: 0.5 (effective 0.4)</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>6. Z-index</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>Overlapping cards; blue (`z:3`) should be on top.</Text>
          <Box style={{ width: 180, height: 120, position: 'relative' }}>
            <Box style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 84,
              height: 84,
              borderRadius: 8,
              backgroundColor: '#ef4444',
              zIndex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>z:1</Text>
            </Box>
            <Box style={{
              position: 'absolute',
              top: 18,
              left: 30,
              width: 84,
              height: 84,
              borderRadius: 8,
              backgroundColor: '#3b82f6',
              zIndex: 3,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>z:3</Text>
            </Box>
            <Box style={{
              position: 'absolute',
              top: 36,
              left: 60,
              width: 84,
              height: 84,
              borderRadius: 8,
              backgroundColor: '#22c55e',
              zIndex: 2,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>z:2</Text>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>7. Per-side borders</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 8,
          alignItems: 'center',
        }}>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Individual sides</Text>
            <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <Box style={{ width: 68, height: 68, backgroundColor: c.bg, borderTopWidth: 3, borderColor: c.error, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top</Text>
              </Box>
              <Box style={{ width: 68, height: 68, backgroundColor: c.bg, borderRightWidth: 3, borderColor: c.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Right</Text>
              </Box>
              <Box style={{ width: 68, height: 68, backgroundColor: c.bg, borderBottomWidth: 3, borderColor: c.success, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Bottom</Text>
              </Box>
              <Box style={{ width: 68, height: 68, backgroundColor: c.bg, borderLeftWidth: 3, borderColor: c.warning, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: c.textSecondary, fontSize: 9 }}>Left</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Combinations</Text>
            <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <Box style={{
                width: 80, height: 58, backgroundColor: c.bg,
                borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#a855f7',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>Top+Bottom</Text>
              </Box>
              <Box style={{
                width: 80, height: 58, backgroundColor: c.bg,
                borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#ec4899',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>Left+Right</Text>
              </Box>
              <Box style={{
                width: 80, height: 58, backgroundColor: c.bg,
                borderLeftWidth: 3, borderBottomWidth: 1, borderColor: c.info,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: c.textSecondary, fontSize: 8 }}>L thick+B thin</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Mixed widths (`1 / 2 / 4 / 6`)</Text>
            <Box style={{
              width: 150, height: 80, backgroundColor: c.bg,
              borderTopWidth: 1, borderRightWidth: 2, borderBottomWidth: 4, borderLeftWidth: 6,
              borderColor: c.text,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top/Right/Bottom/Left</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
