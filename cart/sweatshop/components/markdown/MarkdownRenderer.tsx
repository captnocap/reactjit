const React: any = require('react');

import { Box, Col, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { CodeFence } from './CodeFence';
import { InlineCode } from './InlineCode';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownLink } from './MarkdownLink';
import { MarkdownTable } from './MarkdownTable';
import type { MarkdownAst, MarkdownBlock, MarkdownInlineNode } from './useMarkdownAst';
import { editorTokenTone } from '../../utils';

function highlightText(text: string, query: string, fontSize: number, color: string, keyPrefix: string) {
  const q = query.trim();
  if (!q) return <Text fontSize={fontSize} color={color}>{text}</Text>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: any[] = [];
  let start = 0;
  while (true) {
    const idx = lower.indexOf(needle, start);
    if (idx < 0) break;
    if (idx > start) out.push(<Text key={`${keyPrefix}-${start}`} fontSize={fontSize} color={color}>{text.slice(start, idx)}</Text>);
    out.push(<Text key={`${keyPrefix}-m-${idx}`} fontSize={fontSize} color={COLORS.blue} style={{ backgroundColor: COLORS.blueDeep }}>{text.slice(idx, idx + q.length)}</Text>);
    start = idx + q.length;
  }
  if (start < text.length) out.push(<Text key={`${keyPrefix}-end`} fontSize={fontSize} color={color}>{text.slice(start)}</Text>);
  return out;
}

function renderInlineNode(node: MarkdownInlineNode, opts: { basePath: string; onOpenPath?: (path: string) => void; fontSize: number; query: string; keyPrefix: string }) {
  const { basePath, onOpenPath, fontSize, query, keyPrefix } = opts;
  switch (node.type) {
    case 'text':
      return highlightText(node.content, query, fontSize, COLORS.text, keyPrefix);
    case 'code':
      return <InlineCode fontSize={fontSize}>{node.content}</InlineCode>;
    case 'strong':
      return <Text fontSize={fontSize} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{node.content}</Text>;
    case 'em':
      return <Text fontSize={fontSize} color={COLORS.text} style={{ fontStyle: 'italic' }}>{node.content}</Text>;
    case 'link':
      return <MarkdownLink basePath={basePath} url={node.url} onOpenPath={onOpenPath}>{node.text}</MarkdownLink>;
    case 'image':
      return <MarkdownImage alt={node.alt} src={node.src} />;
    default:
      return null;
  }
}

function renderInline(nodes: MarkdownInlineNode[], opts: { basePath: string; onOpenPath?: (path: string) => void; fontSize: number; query: string; prefix: string }) {
  return nodes.map((node, index) => <React.Fragment key={`${opts.prefix}-${index}`}>{renderInlineNode(node, { ...opts, keyPrefix: `${opts.prefix}-${index}` })}</React.Fragment>);
}

function renderBlock(block: MarkdownBlock, opts: { basePath: string; onOpenPath?: (path: string) => void; fontSize: number; lineWidth: number; query: string; onHeadingLayout?: (id: string, y: number) => void }) {
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
          <Text fontSize={size} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {renderInline(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: size, query: opts.query, prefix: block.id })}
          </Text>
        </Box>
      );
    }
    case 'paragraph':
      return (
        <Row key={`${block.type}-${block.line}`} style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
          {renderInline(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, prefix: `p-${block.line}` })}
        </Row>
      );
    case 'list':
      return (
        <Col key={`${block.type}-${block.line}`} style={{ gap: 4, paddingLeft: 8 }}>
          {block.items.map((item, index) => (
            <Row key={index} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Text fontSize={opts.fontSize} color={COLORS.textDim}>{block.ordered ? `${index + 1}.` : '•'}</Text>
              <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', flexGrow: 1, flexBasis: 0 }}>
                {renderInline(item, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, prefix: `li-${block.line}-${index}` })}
              </Row>
            </Row>
          ))}
        </Col>
      );
    case 'quote':
      return (
        <Box key={`${block.type}-${block.line}`} style={{ paddingLeft: 10, borderLeftWidth: 3, borderColor: COLORS.blue, marginLeft: 4 }}>
          <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
            {renderInline(block.content, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, prefix: `q-${block.line}` })}
          </Row>
        </Box>
      );
    case 'codeblock':
      return <CodeFence key={`${block.type}-${block.line}`} language={block.language} content={block.content} fontSize={opts.fontSize} />;
    case 'table':
      return <MarkdownTable key={`${block.type}-${block.line}`} header={block.header} rows={block.rows} fontSize={opts.fontSize} renderInline={(nodes) => <Row style={{ flexWrap: 'wrap', gap: 2 }}>{renderInline(nodes, { basePath: opts.basePath, onOpenPath: opts.onOpenPath, fontSize: opts.fontSize, query: opts.query, prefix: `t-${block.line}` })}</Row>} />;
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
}) {
  return (
    <ScrollView
      showScrollbar={true}
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
