import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function PerSideBorderStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      {/* Individual sides */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Individual border sides</Text>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{ width: 70, height: 70, backgroundColor: c.bg, borderTopWidth: 3, borderColor: c.error, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: c.bg, borderRightWidth: 3, borderColor: c.primary, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Right</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: c.bg, borderBottomWidth: 3, borderColor: c.success, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Bottom</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: c.bg, borderLeftWidth: 3, borderColor: c.warning, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Left</Text>
          </Box>
        </Box>
      </Box>

      {/* Combinations */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Combinations</Text>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{
            width: 80, height: 60, backgroundColor: c.bg,
            borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#a855f7',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Top+Bottom</Text>
          </Box>
          <Box style={{
            width: 80, height: 60, backgroundColor: c.bg,
            borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#ec4899',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>Left+Right</Text>
          </Box>
          <Box style={{
            width: 80, height: 60, backgroundColor: c.bg,
            borderLeftWidth: 3, borderBottomWidth: 1, borderColor: c.info,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: c.textSecondary, fontSize: 9 }}>L thick+B thin</Text>
          </Box>
        </Box>
      </Box>

      {/* Different widths per side */}
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Mixed widths (all sides different)</Text>
        <Box style={{
          width: 150, height: 80, backgroundColor: c.bg,
          borderTopWidth: 1, borderRightWidth: 2, borderBottomWidth: 4, borderLeftWidth: 6,
          borderColor: c.text,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: c.textSecondary, fontSize: 9 }}>1 / 2 / 4 / 6</Text>
        </Box>
      </Box>
    </Box>
  );
}
