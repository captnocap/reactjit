import React from 'react';
import { Box, Text, ChartTooltip } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function BoxBasicStory() {
  const c = useThemeColors();
  const [hoveredLayer, setHoveredLayer] = React.useState<'outer' | 'middle' | 'inner' | null>(null);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Box style={{ width: 420, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Unstyled boxes (hover to inspect nesting)</Text>
        <Box style={{
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          padding: 14,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
        }}>
          <Box
            onPointerEnter={() => setHoveredLayer('outer')}
            onPointerLeave={() => setHoveredLayer(prev => (prev === 'outer' ? null : prev))}
            style={{
              width: 300,
              height: 170,
              position: 'relative',
              borderWidth: 1,
              borderColor: c.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ChartTooltip visible={hoveredLayer === 'outer'} anchor="top">
              <ChartTooltip.Value>Outer Box</ChartTooltip.Value>
            </ChartTooltip>
            <Box
              onPointerEnter={() => setHoveredLayer('middle')}
              onPointerLeave={() => setHoveredLayer(prev => (prev === 'middle' ? null : prev))}
              style={{
                width: 220,
                height: 120,
                position: 'relative',
                borderWidth: 1,
                borderColor: c.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ChartTooltip visible={hoveredLayer === 'middle'} anchor="top">
                <ChartTooltip.Value>Middle Box</ChartTooltip.Value>
              </ChartTooltip>
              <Box
                onPointerEnter={() => setHoveredLayer('inner')}
                onPointerLeave={() => setHoveredLayer(prev => (prev === 'inner' ? null : prev))}
                style={{
                  width: 140,
                  height: 75,
                  position: 'relative',
                  borderWidth: 1,
                  borderColor: c.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ChartTooltip visible={hoveredLayer === 'inner'} anchor="top">
                  <ChartTooltip.Value>Inner Box</ChartTooltip.Value>
                </ChartTooltip>
              </Box>
            </Box>
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Styled + nested boxes (centered)</Text>
        <Box style={{
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          padding: 14,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
        }}>
          <Box style={{
            width: 300,
            height: 170,
            backgroundColor: c.surface,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Box style={{
              width: 220,
              height: 120,
              backgroundColor: c.primary,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Box style={{
                width: 140,
                height: 75,
                backgroundColor: c.accent,
                borderRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#ffffff', fontSize: 12 }}>Centered</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
