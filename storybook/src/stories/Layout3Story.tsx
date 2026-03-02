import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

function Divider() {
  const c = useThemeColors();
  return (
    <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />
  );
}

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

export function Layout3Story() {
  const c = useThemeColors();
  const half = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, half);
  const col2 = PROPS.slice(half);

  return (
    <Box style={{
      width: '100vw',
      height: '100%',
      backgroundColor: c.bg,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Box style={{
        width: '80vw',
        height: '100%',
        justifyContent: 'center',
      }}>
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
            <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold', textAlign: 'left' }}>
              {'Box'}
            </Text>
            <Box style={{
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
            }}>
              <Text style={{ color: c.muted, fontSize: 10, textAlign: 'left' }}>
                {'<Box bg="#3b82f6" radius={8} padding={16} />'}
              </Text>
            </Box>
            <Text style={{ color: c.muted, fontSize: 10, textAlign: 'left' }}>
              {'The most primitive visual element. A rectangle that contains other rectangles.'}
            </Text>
            <Box style={{ width: 130, height: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 9, textAlign: 'center' }}>{'Playground Mode Toggle'}</Text>
            </Box>
          </Box>

          <Divider />

          {/* Section 2 — flexGrow center */}
          <Box style={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Box style={{ backgroundColor: '#ff69b4', borderRadius: 8, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
              <Box />
            </Box>
          </Box>

          <Divider />

          {/* Section 3 — fit-content columns */}
          <Box style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <Box style={{ width: 'fit-content', gap: 2, justifyContent: 'center' }}>
              {col1.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, textAlign: 'left', flexShrink: 0 }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left', flexShrink: 0 }}>{type}</Text>
                </Box>
              ))}
            </Box>
            <Box style={{ width: 'fit-content', gap: 2, justifyContent: 'center' }}>
              {col2.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, textAlign: 'left', flexShrink: 0 }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left', flexShrink: 0 }}>{type}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
