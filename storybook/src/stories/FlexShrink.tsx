import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function FlexShrinkStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Default shrink (all shrink equally) */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Default shrink (items wider than container)</Text>
        <Box style={{ flexDirection: 'row', width: 250, gap: 4 }}>
          <Box style={{ width: 120, height: 40, backgroundColor: '#ef4444', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
          </Box>
          <Box style={{ width: 120, height: 40, backgroundColor: '#f97316', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
          </Box>
          <Box style={{ width: 120, height: 40, backgroundColor: '#eab308', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>120px</Text>
          </Box>
        </Box>
      </Box>

      {/* One item flexShrink: 0 (won't shrink) */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>First item: flexShrink 0 (won't shrink)</Text>
        <Box style={{ flexDirection: 'row', width: 250, gap: 4 }}>
          <Box style={{ width: 120, height: 40, flexShrink: 0, backgroundColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>No shrink</Text>
          </Box>
          <Box style={{ width: 120, height: 40, backgroundColor: '#6366f1', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>Shrinks</Text>
          </Box>
          <Box style={{ width: 120, height: 40, backgroundColor: '#8b5cf6', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>Shrinks</Text>
          </Box>
        </Box>
      </Box>

      {/* Different shrink ratios */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Shrink ratios: 1 / 2 / 3</Text>
        <Box style={{ flexDirection: 'row', width: 200, gap: 4 }}>
          <Box style={{ width: 120, height: 40, flexShrink: 1, backgroundColor: '#22c55e', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>1x</Text>
          </Box>
          <Box style={{ width: 120, height: 40, flexShrink: 2, backgroundColor: '#14b8a6', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>2x</Text>
          </Box>
          <Box style={{ width: 120, height: 40, flexShrink: 3, backgroundColor: '#06b6d4', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>3x</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
