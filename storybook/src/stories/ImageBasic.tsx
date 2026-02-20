import React from 'react';
import { Box, Text, Image, useRendererMode } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const WEB_PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">' +
  '<rect width="320" height="220" fill="#334155"/>' +
  '<text x="160" y="115" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="18">placeholder</text>' +
  '</svg>'
);
const NATIVE_PLACEHOLDER_SRC = 'lib/placeholder.png';

export function ImageBasicStory() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const placeholderSrc = mode === 'native' ? NATIVE_PLACEHOLDER_SRC : WEB_PLACEHOLDER_SRC;
  return (
    <Box style={{ width: '100%', gap: 12, padding: 16 }}>
      {/* Basic image */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Default (fill)</Text>
        <Image src={placeholderSrc} style={{ width: 200, height: 100 }} />
      </Box>

      {/* objectFit: contain */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>objectFit: contain</Text>
        <Box style={{ width: 200, height: 100, backgroundColor: c.bgElevated, borderRadius: 4 }}>
          <Image src={placeholderSrc} style={{ width: 200, height: 100, objectFit: 'contain' }} />
        </Box>
      </Box>

      {/* objectFit: cover */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>objectFit: cover</Text>
        <Box style={{ width: 200, height: 80, borderRadius: 4, overflow: 'hidden' }}>
          <Image src={placeholderSrc} style={{ width: 200, height: 80, objectFit: 'cover' }} />
        </Box>
      </Box>

      {/* Rounded image */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>With borderRadius</Text>
        <Image src={placeholderSrc} style={{ width: 80, height: 80, borderRadius: 40 }} />
      </Box>
    </Box>
  );
}
