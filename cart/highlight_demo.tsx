// Highlight Demo — pill-style affordances.
//
// Tags as pills: tight padding (just enough for the text), pill-rounded
// border. Click to set active. Hover any other to preview.
//   • active pill = continuous marching border + static autonomous bloom
//   • hovered pill = traced border + cursor flashlight
//
// Importing component-gallery's gallery-theme bootstraps the cockpit warm
// palette so first paint shows the intended colors.

import { useState } from 'react';
import { Box, Row, Col, Text } from '@reactjit/runtime/primitives';
import { Highlight } from '@reactjit/runtime/highlight';
import './app/gallery/gallery-theme';

const TAGS = ['urgent', 'work', 'personal', 'errands', 'someday', 'reading', 'ideas', 'archive'];

export default function HighlightDemo() {
  const [active, setActive] = useState<string>('work');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0e0b09', paddingTop: 60, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
      <Col style={{ width: '100%', alignItems: 'center', gap: 30 }}>
        <Col style={{ alignItems: 'center', gap: 6 }}>
          <Text fontSize={20} color="#f2e8dc" bold style={{ letterSpacing: 1.2 }}>
            HIGHLIGHT · PILLS
          </Text>
          <Text fontSize={11} color="#b8a890">
            Click to set active. Hover for trace + flashlight preview.
          </Text>
        </Col>

        <Row style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
          {TAGS.map(tag => (
            <Highlight
              key={tag}
              type="ember"
              active={tag === active}
              onPress={() => setActive(tag)}
              borderRadius={999}
            >
              <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7 }}>
                <Text fontSize={12} color="#f2e8dc" bold>{tag}</Text>
              </Box>
            </Highlight>
          ))}
        </Row>
      </Col>
    </Box>
  );
}
