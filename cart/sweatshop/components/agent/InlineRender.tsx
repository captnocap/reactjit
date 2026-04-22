const React: any = require('react');
import { Box, Pressable, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { MarkdownNode } from './markdown';

export function InlineRender(props: { nodes: MarkdownNode[]; baseFontSize?: number; baseColor?: string }) {
  const { nodes, baseFontSize = 11, baseColor = COLORS.text } = props;
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <Text key={i} fontSize={baseFontSize} color={baseColor}>{node.content}</Text>;
      case 'bold':
        return <Text key={i} fontSize={baseFontSize} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{node.content}</Text>;
      case 'italic':
        return <Text key={i} fontSize={baseFontSize} color={baseColor} style={{ fontStyle: 'italic' }}>{node.content}</Text>;
      case 'code':
        return (
          <Box key={i} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 4, backgroundColor: COLORS.grayDeep }}>
            <Text fontSize={baseFontSize - 1} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{node.content}</Text>
          </Box>
        );
      case 'link':
        return (
          <Pressable key={i} onPress={() => {}}>
            <Text fontSize={baseFontSize} color={COLORS.blue} style={{ textDecorationLine: 'underline' }}>{node.text}</Text>
          </Pressable>
        );
      default:
        return null;
    }
  });
}
