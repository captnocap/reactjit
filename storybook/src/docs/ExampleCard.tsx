import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';
import { CodeBlock } from './CodeBlock';
import { useDocsFontScale } from './DocsFontScale';

const PLATFORM_COLORS: Record<string, string> = {
  love2d: '#e74c3c',
  web: '#3498db',
  terminal: '#2ecc71',
  cc: '#f39c12',
  nvim: '#57a64a',
  hs: '#9b59b6',
  awesome: '#1abc9c',
  all: '#64748b',
};

interface ExampleCardProps {
  title: string;
  code: string;
  platforms: string[];
}

export function ExampleCard({ title, code, platforms }: ExampleCardProps) {
  const { scale } = useDocsFontScale();
  const s = (base: number) => Math.round(base * scale);

  return (
    <Box style={{ marginBottom: 12 }}>
      <Text style={{ color: '#cbd5e1', fontSize: s(10), lineHeight: s(16), fontWeight: 'bold', marginBottom: 4 }}>
        {title}
      </Text>
      <CodeBlock code={code} />
      {platforms.length > 0 && (
        <Box style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {platforms.map(p => (
            <Box key={p} style={{
              backgroundColor: (PLATFORM_COLORS[p] || '#64748b') + '22',
              borderRadius: 2,
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 1,
              paddingBottom: 1,
            }}>
              <Text style={{ color: PLATFORM_COLORS[p] || '#64748b', fontSize: s(8), lineHeight: s(12) }}>{p}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
