import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function PerSideBorderStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Individual sides */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Individual border sides</Text>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{ width: 70, height: 70, backgroundColor: '#0f172a', borderTopWidth: 3, borderColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Top</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: '#0f172a', borderRightWidth: 3, borderColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Right</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: '#0f172a', borderBottomWidth: 3, borderColor: '#22c55e', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Bottom</Text>
          </Box>
          <Box style={{ width: 70, height: 70, backgroundColor: '#0f172a', borderLeftWidth: 3, borderColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Left</Text>
          </Box>
        </Box>
      </Box>

      {/* Combinations */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Combinations</Text>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{
            width: 80, height: 60, backgroundColor: '#0f172a',
            borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#a855f7',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Top+Bottom</Text>
          </Box>
          <Box style={{
            width: 80, height: 60, backgroundColor: '#0f172a',
            borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#ec4899',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>Left+Right</Text>
          </Box>
          <Box style={{
            width: 80, height: 60, backgroundColor: '#0f172a',
            borderLeftWidth: 3, borderBottomWidth: 1, borderColor: '#06b6d4',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#94a3b8', fontSize: 9 }}>L thick+B thin</Text>
          </Box>
        </Box>
      </Box>

      {/* Different widths per side */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 8 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Mixed widths (all sides different)</Text>
        <Box style={{
          width: 150, height: 80, backgroundColor: '#0f172a',
          borderTopWidth: 1, borderRightWidth: 2, borderBottomWidth: 4, borderLeftWidth: 6,
          borderColor: '#e2e8f0',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#94a3b8', fontSize: 9 }}>1 / 2 / 4 / 6</Text>
        </Box>
      </Box>
    </Box>
  );
}
