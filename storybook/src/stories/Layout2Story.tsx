import React from 'react';
import { Box, Text, Row, Col } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

const PROPS: [string, string][] = [
  ['style', 'ViewStyle'],
  ['bg', 'string'],
  ['radius', 'number'],
  ['padding', 'number'],
  ['tooltip', 'TooltipConfig'],
  ['onPress', '() => void'],
  ['onHoverIn', '() => void'],
  ['onHoverOut', '() => void'],
  ['onLayout', '(e) => void'],
  ['children', 'ReactNode'],
  ['testId', 'string'],
  ['pointerEvents', 'enum'],
  ['accessibilityLabel', 'string'],
];

export function Layout2Story() {
  const c = useThemeColors();
  const half = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, half);
  const col2 = PROPS.slice(half);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: '80%', height: '100%', justifyContent: 'center' }}>
        <Box style={{
          width: '100%',
          height: 'fit-content',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'stretch',
          backgroundColor: c.bgElevated,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
          gap: 14,
        }}>
          {/* Section 1 */}
          <Box style={{ justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Box'}</Text>
            <Box style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
              <Text style={{ color: c.muted, fontSize: 10 }}>{'<Box bg="#3b82f6" radius={8} padding={16} />'}</Text>
            </Box>
            <Text style={{ color: c.muted, fontSize: 10 }}>{'The most primitive visual element.'}</Text>
            <Box style={{ width: 130, height: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 9 }}>{'Playground Mode Toggle'}</Text>
            </Box>
          </Box>

          {/* Divider */}
          <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />

          {/* Section 2 — flexGrow center */}
          <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Box style={{ backgroundColor: '#ff69b4', borderRadius: 8, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <Box />
            </Box>
          </Box>

          {/* Divider */}
          <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />

          {/* Section 3 — Grid-based 2 columns */}
          <Row wrap gap={4}>
            <Col sm={12} md={6}>
              {col1.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, flexShrink: 0 }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, flexShrink: 0 }}>{type}</Text>
                </Box>
              ))}
            </Col>
            <Col sm={12} md={6}>
              {col2.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, flexShrink: 0 }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, flexShrink: 0 }}>{type}</Text>
                </Box>
              ))}
            </Col>
          </Row>
        </Box>
      </Box>
    </Box>
  );
}
