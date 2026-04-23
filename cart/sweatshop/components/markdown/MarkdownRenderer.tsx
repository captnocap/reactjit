const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { CodeFence } from './CodeFence';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownTable } from './MarkdownTable';
import { renderMarkdownInlineNodes } from './inlineRenderer';
import type { MarkdownAst, MarkdownBlock } from './useMarkdownAst';

function renderBlock(block: MarkdownBlock, opts: { basePath: string; onOpenPath?: (path: string) => void; onAnchorPress?: (id: string) => void; fontSize: number; lineWidth: number; query: string; onHeadingLayout?: (id: string, y: number) => void }) {
  switch (block.type) {
    case 'heading': {
      const sizes = [0, 20, 18, 16, 14, 13, 12];
      const size = sizes[block.level] || 14;
      return (
        <Box
          key={`${block.type}-${block.line}`}
          onLayout={(rect: any) => { if (opts.onHeadingLayout) opts.onHeadingLayout(block.id, rect?.y || 0); }}
          style={{ gap: 4, paddingTop: 8, paddingBottom: 2 }}
        >
          <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {opts.onAnchorPress ? (
              <Pressable
                onPress={() => opts.onAnchorPress?.(block.id)}
                style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}
              >
                <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>#</Text>
              </Pressable>
            ) : null}
            <Text fontSize={size} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {renderMarkdownInlineNodes(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: size, query: opts.query, keyPrefix: block.id })}
            </Text>
          </Row>
        </Box>
      );
    }
    case 'paragraph':
      return (
        <Row key={`${block.type}-${block.line}`} style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
          {renderMarkdownInlineNodes(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, keyPrefix: `p-${block.line}` })}
        </Row>
      );
    case 'list':
      return (
        <Col key={`${block.type}-${block.line}`} style={{ gap: 4, paddingLeft: 8 }}>
          {block.items.map((item, index) => (
            <Row key={index} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Text fontSize={opts.fontSize} color={COLORS.textDim}>{block.ordered ? `${index + 1}.` : '•'}</Text>
              <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', flexGrow: 1, flexBasis: 0 }}>
                {renderMarkdownInlineNodes(item, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, keyPrefix: `li-${block.line}-${index}` })}
              </Row>
            </Row>
          ))}
        </Col>
      );
    case 'quote':
      return (
        <Box key={`${block.type}-${block.line}`} style={{ paddingLeft: 10, borderLeftWidth: 3, borderColor: COLORS.blue, marginLeft: 4 }}>
          <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
            {renderMarkdownInlineNodes(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, keyPrefix: `q-${block.line}` })}
          </Row>
        </Box>
      );
    case 'codeblock':
      return <CodeFence key={`${block.type}-${block.line}`} language={block.language} content={block.content} fontSize={opts.fontSize} />;
    case 'table':
      return <MarkdownTable key={`${block.type}-${block.line}`} header={block.header} rows={block.rows} fontSize={opts.fontSize} renderInline={(nodes) => <Row style={{ flexWrap: 'wrap', gap: 2 }}>{renderMarkdownInlineNodes(nodes, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, keyPrefix: `t-${block.line}` })}</Row>} />;
    case 'image':
      return <MarkdownImage key={`${block.type}-${block.line}`} alt={block.alt} src={block.src} />;
    case 'hr':
      return <Box key={`${block.type}-${block.line}`} style={{ height: 1, backgroundColor: COLORS.borderSoft, marginTop: 8, marginBottom: 8 }} />;
    default:
      return null;
  }
}

export function MarkdownRenderer(props: {
  ast: MarkdownAst;
  basePath: string;
  fontSize: number;
  lineWidth: number;
  query: string;
  scrollY: number;
  onScroll: (y: number) => void;
  onHeadingLayout: (id: string, y: number) => void;
  onOpenPath?: (path: string) => void;
  onAnchorPress?: (id: string) => void;
}) {
  return (
    <ScrollView
      showScrollbar={true}
      scrollY={props.scrollY}
      onScroll={(payload: any) => {
        const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
        props.onScroll(next);
      }}
      style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}
    >
      <Col style={{ alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 18, paddingBottom: 24 }}>
        <Col style={{ width: '100%', maxWidth: props.lineWidth, gap: 14 }}>
          {props.ast.blocks.map((block) => renderBlock(block, {
            basePath: props.basePath,
            onOpenPath: props.onOpenPath,
            onAnchorPress: props.onAnchorPress,
            fontSize: props.fontSize,
            lineWidth: props.lineWidth,
            query: props.query,
            onHeadingLayout: props.onHeadingLayout,
          }))}
        </Col>
      </Col>
    </ScrollView>
  );
}
