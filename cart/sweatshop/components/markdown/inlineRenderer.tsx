import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { InlineCode } from './InlineCode';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownLink } from './MarkdownLink';
import { parseInlineMarkdown, type MarkdownInlineNode } from './useMarkdownAst';

export type MarkdownInlineRenderOptions = {
  basePath?: string;
  onOpenPath?: (path: string) => void;
  fontSize?: number;
  color?: string;
  query?: string;
  keyPrefix?: string;
  onError?: (error: unknown) => void;
};

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

function renderInlineNode(node: MarkdownInlineNode, opts: Required<Pick<MarkdownInlineRenderOptions, 'fontSize' | 'query'>> & MarkdownInlineRenderOptions & { keyPrefix: string }) {
  const fontSize = opts.fontSize;
  const color = opts.color || COLORS.text;
  switch (node.type) {
    case 'text':
      return highlightText(node.content, opts.query, fontSize, color, opts.keyPrefix);
    case 'code':
      return <InlineCode fontSize={fontSize}>{node.content}</InlineCode>;
    case 'strong':
      return <Text fontSize={fontSize} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{node.content}</Text>;
    case 'em':
      return <Text fontSize={fontSize} color={color} style={{ fontStyle: 'italic' }}>{node.content}</Text>;
    case 'link':
      return <MarkdownLink basePath={opts.basePath} url={node.url} onOpenPath={opts.onOpenPath} color={COLORS.blue}>{node.text}</MarkdownLink>;
    case 'image':
      return <MarkdownImage alt={node.alt} src={node.src} />;
    default:
      return null;
  }
}

export function renderMarkdownInlineNodes(nodes: MarkdownInlineNode[], opts: MarkdownInlineRenderOptions = {}) {
  const base = {
    basePath: opts.basePath,
    onOpenPath: opts.onOpenPath,
    fontSize: opts.fontSize ?? 11,
    color: opts.color || COLORS.text,
    query: opts.query || '',
    keyPrefix: opts.keyPrefix || 'md-inline',
    onError: opts.onError,
  };
  return nodes.map((node, index) => (
    <React.Fragment key={`${base.keyPrefix}-${index}`}>
      {renderInlineNode(node, { ...base, keyPrefix: `${base.keyPrefix}-${index}` })}
    </React.Fragment>
  ));
}

export function renderMarkdownInline(text: string, opts: MarkdownInlineRenderOptions = {}) {
  const source = String(text || '');
  try {
    const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const fontSize = opts.fontSize ?? 11;
    const color = opts.color || COLORS.text;
    if (lines.length === 1) {
      const nodes = parseInlineMarkdown(normalized);
      return (
        <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', minWidth: 0 }}>
          {renderMarkdownInlineNodes(nodes, { ...opts, fontSize, color, keyPrefix: opts.keyPrefix || 'md-inline' })}
        </Row>
      );
    }
    return (
      <Col style={{ gap: 2, minWidth: 0 }}>
        {lines.map((line, lineIndex) => {
          if (line.length === 0) {
            return <Box key={`md-inline-empty-${lineIndex}`} style={{ height: Math.max(8, Math.round(fontSize * 0.7)) }} />;
          }
          const nodes = parseInlineMarkdown(line);
          return (
            <Row key={`md-inline-line-${lineIndex}`} style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', minWidth: 0 }}>
              {renderMarkdownInlineNodes(nodes, { ...opts, fontSize, color, keyPrefix: `${opts.keyPrefix || 'md-inline'}-${lineIndex}` })}
            </Row>
          );
        })}
      </Col>
    );
  } catch (error) {
    try { opts.onError?.(error); } catch {}
    try { (globalThis as any).__hostLog?.(0, '[markdown] inline render failed: ' + String((error as any)?.message || error)); } catch {}
    try { console.error('[markdown] inline render failed', error, source); } catch {}
    return (
      <Text fontSize={opts.fontSize ?? 11} color={opts.color || COLORS.text} style={{ whiteSpace: 'pre-wrap', minWidth: 0 }}>
        {source}
      </Text>
    );
  }
}
