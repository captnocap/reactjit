import React from 'react';
import { Box, Text, Image } from '../../../../packages/shared/src';

// Use a simple data URI so no external assets are needed
const PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">' +
  '<rect width="200" height="150" fill="#334155"/>' +
  '<text x="100" y="75" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">200x150</text>' +
  '</svg>'
);

export function ImageBasicStory() {
  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Basic image */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Default (fill)</Text>
        <Image src={PLACEHOLDER_SRC} style={{ width: 200, height: 100 }} />
      </Box>

      {/* objectFit: contain */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>objectFit: contain</Text>
        <Box style={{ width: 200, height: 100, backgroundColor: '#1e293b', borderRadius: 4 }}>
          <Image src={PLACEHOLDER_SRC} style={{ width: 200, height: 100, objectFit: 'contain' }} />
        </Box>
      </Box>

      {/* objectFit: cover */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>objectFit: cover</Text>
        <Box style={{ width: 200, height: 80, borderRadius: 4, overflow: 'hidden' }}>
          <Image src={PLACEHOLDER_SRC} style={{ width: 200, height: 80, objectFit: 'cover' }} />
        </Box>
      </Box>

      {/* Rounded image */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>With borderRadius</Text>
        <Image src={PLACEHOLDER_SRC} style={{ width: 80, height: 80, borderRadius: 40 }} />
      </Box>
    </Box>
  );
}
