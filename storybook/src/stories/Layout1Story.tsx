/**
 * Layout 1 — Reference page layout for documenting a single primitive.
 *
 * Structure:
 *   Page (100% x 100%, theme bg, justify center)
 *     Inner (80% x 100%, justify center)
 *       Header (100% x 20%, themed card, rounded, space-around row)
 *         Section 1: Title, code snippet, description, playground toggle
 *         | divider |
 *         Section 2: The primitive rendered raw — flexGrow center stage
 *         | divider |
 *         Section 3: Props/types in 2 equal columns (flexGrow:1, flexBasis:0)
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

function Wireframe({ label, style }: { label: string; style?: any }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 6,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      ...style,
    }}>
      <Text style={{ color: c.muted, fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

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
  ['onAccessibilityAction', '(event: AccessibilityActionEvent) => void'],
  ['importantForAccessibility', 'auto | yes | no | no-hide-descendants'],
  ['hitSlop', 'number | Insets'],
  ['collapsable', 'boolean'],
  ['needsOffscreenAlphaCompositing', 'boolean'],
  ['renderToHardwareTextureAndroid', 'boolean'],
  ['shouldRasterizeIOS', 'boolean'],
  ['removeClippedSubviews', 'boolean'],
  ['nativeID', 'string'],
  ['focusable', 'boolean'],
  ['onStartShouldSetResponder', '(event: GestureResponderEvent) => boolean'],
  ['onMoveShouldSetResponder', '(event: GestureResponderEvent) => boolean'],
  ['onResponderGrant', '(event: GestureResponderEvent) => void'],
  ['onResponderReject', '(event: GestureResponderEvent) => void'],
  ['onResponderMove', '(event: GestureResponderEvent) => void'],
  ['onResponderRelease', '(event: GestureResponderEvent) => void'],
  ['onResponderTerminate', '(event: GestureResponderEvent) => void'],
  ['onMagicTap', '() => void'],
  ['elevation', 'number'],
  ['overflow', 'visible | hidden | scroll'],
  ['backfaceVisibility', 'visible | hidden'],
  ['opacity', 'number'],
  ['transform', 'TransformArray'],
  ['shadowColor', 'ColorValue'],
  ['shadowOffset', '{ width: number, height: number }'],
  ['shadowOpacity', 'number'],
  ['shadowRadius', 'number'],
];

export function Layout1Story() {
  const c = useThemeColors();

  // Split props into 2 columns
  const mid = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, mid);
  const col2 = PROPS.slice(mid);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: c.bg,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Inner page container */}
      <Box style={{
        minWidth: 'fit-content',
        maxWidth: '80%',
        height: '100%',
        justifyContent: 'center',
      }}>
        {/* ── Header: themed card with 3 sections ── */}
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

          {/* Section 1: Title + code snippet + desc + playground toggle */}
          <Box style={{
            width: 170,
            flexShrink: 0,
            justifyContent: 'center',
            gap: 6,
          }}>
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

            <Wireframe label="Playground Mode Toggle" style={{ width: 130, height: 24 }} />
          </Box>

          <Divider />

          {/* Section 2: The primitive — center stage, flexGrow fills remaining space */}
          <Box style={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Box style={{ backgroundColor: '#ff69b4', borderRadius: 8, padding: 20 }} />
          </Box>

          <Divider />

          {/* Section 3: Props/types — 2 equal columns */}
          <Box style={{
            flexDirection: 'row',
            gap: 8,
          }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              {col1.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, textAlign: 'left' }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left' }}>{type}</Text>
                </Box>
              ))}
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              {col2.map(([prop, type]) => (
                <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 9, textAlign: 'left' }}>{prop}</Text>
                  <Text style={{ color: c.muted, fontSize: 9, textAlign: 'left' }}>{type}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
