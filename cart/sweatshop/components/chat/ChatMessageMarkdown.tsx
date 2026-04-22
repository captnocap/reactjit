import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { renderMarkdownInline } from '../../lib/markdown/inline';

export function ChatMessageMarkdown(props: {
  text: string;
  basePath?: string;
  fontSize?: number;
  color?: string;
  onOpenPath?: (path: string) => void;
}) {
  const fontSize = props.fontSize ?? 11;
  const color = props.color || COLORS.text;
  const source = String(props.text || '');

  try {
    return (
      <Col style={{ gap: 4, minWidth: 0, maxWidth: '100%', flexGrow: 1, flexBasis: 0 }}>
        <Box style={{
          minWidth: 0,
          maxWidth: '100%',
          paddingTop: 1,
          paddingBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          borderRadius: TOKENS.radiusSm,
        }}>
          {renderMarkdownInline(source, {
            basePath: props.basePath,
            onOpenPath: props.onOpenPath,
            fontSize,
            color,
            keyPrefix: 'chat-md',
          })}
        </Box>
      </Col>
    );
  } catch (error) {
    try { (globalThis as any).__hostLog?.(0, '[markdown] chat render failed: ' + String((error as any)?.message || error)); } catch {}
    try { console.error('[markdown] chat render failed', error, source); } catch {}
    return (
      <Col style={{ gap: 4, minWidth: 0, maxWidth: '100%' }}>
        <Text fontSize={9} color={COLORS.red} style={{ fontWeight: 'bold' }}>markdown render failed</Text>
        <Text fontSize={fontSize} color={color} style={{ whiteSpace: 'pre-wrap', minWidth: 0 }}>{source}</Text>
      </Col>
    );
  }
}
