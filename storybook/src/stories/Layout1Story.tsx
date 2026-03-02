/**
 * Layout 1 — Component documentation page (demo).
 *
 * Thin wrapper around ComponentDoc that demonstrates the pattern.
 * Uses docKey="box" to auto-populate all doc sections from content.json.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { ComponentDoc, Wireframe, styleTooltip } from './_shared/ComponentDoc';

const STARTER_CODE = `<Box style={{
  backgroundColor: '#3b82f6',
  borderRadius: 8,
  padding: 16,
  gap: 8,
}}>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
    Hello
  </Text>
  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
    Edit this code to see live changes
  </Text>
</Box>`;

function BoxPreview() {
  const custom1 = { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16 };
  const custom2 = { backgroundColor: '#10b981', borderRadius: 12, padding: 10, borderWidth: 2, borderColor: '#065f46' };

  return (
    <>
      <Box style={{ ...custom1, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom1)}>
        <Text style={{ color: 'white', fontSize: 10 }}>{'Styled element'}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Wireframe label="A" style={{ width: 40, height: 40 }} />
        <Wireframe label="B" style={{ width: 40, height: 40 }} />
      </Box>

      <Box style={{ ...custom2, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom2)}>
        <Text style={{ color: 'white', fontSize: 10 }}>{'Another styled'}</Text>
      </Box>
    </>
  );
}

export function Layout1Story() {
  return (
    <ComponentDoc
      docKey="box"
      starterCode={STARTER_CODE}
      preview={<BoxPreview />}
    />
  );
}
