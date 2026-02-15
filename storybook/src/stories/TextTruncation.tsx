import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

const LONG_TEXT = 'The quick brown fox jumps over the lazy dog. This sentence is deliberately long to test how text truncation works across both renderers.';

export function TextTruncationStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Single line truncation */}
      <Box style={{ width: 200, backgroundColor: '#1e293b', padding: 8, borderRadius: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>numberOfLines: 1</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13 }} numberOfLines={1}>
          {LONG_TEXT}
        </Text>
      </Box>

      {/* Two line truncation */}
      <Box style={{ width: 200, backgroundColor: '#1e293b', padding: 8, borderRadius: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>numberOfLines: 2</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13 }} numberOfLines={2}>
          {LONG_TEXT}
        </Text>
      </Box>

      {/* No truncation (reference) */}
      <Box style={{ width: 200, backgroundColor: '#1e293b', padding: 8, borderRadius: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>No limit</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
          {LONG_TEXT}
        </Text>
      </Box>
    </Box>
  );
}
