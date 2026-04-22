const React: any = require('react');

import { Box, Col, Pressable, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { MarkdownHeading } from './useMarkdownAst';

export function HeadingNav(props: {
  headings: MarkdownHeading[];
  activeId?: string;
  visible?: boolean;
  onJump: (id: string) => void;
}) {
  if (!props.visible || props.headings.length === 0) return null;

  return (
    <Box style={{
      position: 'absolute',
      right: 10,
      top: 10,
      bottom: 10,
      width: 250,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: TOKENS.radiusLg,
      backgroundColor: COLORS.panelBg,
      overflow: 'hidden',
    }}>
      <Col style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Table of Contents</Text>
      </Col>
      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0 }}>
        <Col style={{ gap: 2, padding: 8 }}>
          {props.headings.map((heading) => {
            const active = heading.id === props.activeId;
            return (
              <Pressable
                key={heading.id}
                onPress={() => props.onJump(heading.id)}
                style={{
                  paddingLeft: 8 + (heading.level - 1) * 8,
                  paddingRight: 8,
                  paddingTop: 7,
                  paddingBottom: 7,
                  borderRadius: TOKENS.radiusSm,
                  backgroundColor: active ? COLORS.blueDeep : 'transparent',
                }}
              >
                <Text fontSize={10 - Math.min(2, heading.level - 1)} color={active ? COLORS.blue : COLORS.textBright} style={{ fontWeight: active ? 'bold' : 'normal' }}>
                  {heading.text}
                </Text>
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </Box>
  );
}
