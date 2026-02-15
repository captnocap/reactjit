import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function AspectRatioStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Square (1:1) from width */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>aspectRatio: 1 (square from width: 80)</Text>
        <Box style={{ width: 80, aspectRatio: 1, backgroundColor: '#ef4444', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>80x80</Text>
        </Box>
      </Box>

      {/* 16:9 from width */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>aspectRatio: 16/9 (from width: 240)</Text>
        <Box style={{ width: 240, aspectRatio: 16 / 9, backgroundColor: '#3b82f6', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>240x135</Text>
        </Box>
      </Box>

      {/* Derive width from height */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>aspectRatio: 2 (from height: 50)</Text>
        <Box style={{ height: 50, aspectRatio: 2, backgroundColor: '#22c55e', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>100x50</Text>
        </Box>
      </Box>

      {/* Row of different ratios */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Row: 1:1, 2:1, 3:1 (all height: 40)</Text>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{ height: 40, aspectRatio: 1, backgroundColor: '#a855f7', borderRadius: 4 }} />
          <Box style={{ height: 40, aspectRatio: 2, backgroundColor: '#d946ef', borderRadius: 4 }} />
          <Box style={{ height: 40, aspectRatio: 3, backgroundColor: '#ec4899', borderRadius: 4 }} />
        </Box>
      </Box>
    </Box>
  );
}
