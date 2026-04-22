const React: any = require('react');
const { useState, useEffect, useMemo } = React;

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import { getModelIconInfo } from '../model-icons';
import type { Message, ToolExecution } from '../types';

// ── Types ─────────────────────────────────────────────────────

export type MarkdownNode =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeblock'; language: string; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'quote'; content: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'rule' };

type InternalNode = MarkdownNode | { type: 'paragraph' };

// ── Clipboard ─────────────────────────────────────────────────

export function copyToClipboard(text: string): void {
  const host: any = globalThis;
  if (typeof host.__clipboard_set === 'function') {
    try {
      host.__clipboard_set(text);
    } catch {}
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }
}

// ── Inline markdown parser ────────────────────────────────────

function parseInline(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let remaining = text;

  const patterns = [
    { regex: /`([^`]+)`/, type: 'code' },
    { regex: /\*\*([^*]+)\*\*/, type: 'bold' },
    { regex: /\*([^*]+)\*/, type: 'italic' },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; type: string } | null = null;

    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && (earliest === null || m.index! < earliest.index)) {
        earliest = { index: m.index!, match: m, type: p.type };
      }
    }

    if (earliest) {
      if (earliest.index > 0) {
        nodes.push({ type: 'text', content: remaining.slice(0, earliest.index) });
      }
      if (earliest.type === 'link') {
        nodes.push({ type: 'link', text: earliest.match[1], url: earliest.match[2] });
      } else {
        nodes.push({ type: earliest.type as any, content: earliest.match[1] });
      }
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    } else {
      nodes.push({ type: 'text', content: remaining });
      break;
    }
  }

  return nodes;
}

// ── Block markdown parser ─────────────────────────────────────

function parseMarkdownInternal(text: string): InternalNode[] {
  const lines = text.split('\n');
  const nodes: InternalNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim();
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        contentLines.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'codeblock', language: language || 'text', content: contentLines.join('\n') });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*{3,}$/)) {
      nodes.push({ type: 'rule' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const contentLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        contentLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push({ type: 'quote', content: contentLines.join('\n') });
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^-\s+(.*)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^-\s+(.*)/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      nodes.push({ type: 'list', items, ordered: false });
      continue;
    }

    // Ordered list
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)/);
        if (!m) break;
        items.push(m[2]);
        i++;
      }
      nodes.push({ type: 'list', items, ordered: true });
      continue;
    }

    // Empty line → paragraph boundary
    if (line.trim() === '') {
      i++;
      const last = nodes[nodes.length - 1];
      if (last && (last as any).type !== 'paragraph') {
        nodes.push({ type: 'paragraph' });
      }
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^---+/) &&
      !lines[i].match(/^\*{3,}$/) &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^-\s+/) &&
      !lines[i].match(/^(\d+)\.\s+/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    const paraText = paraLines.join(' ');
    const inlineNodes = parseInline(paraText);
    nodes.push(...inlineNodes);
  }

  return nodes;
}

export function parseMarkdown(text: string): MarkdownNode[] {
  return parseMarkdownInternal(text) as MarkdownNode[];
}

// ── Inline render helper ──────────────────────────────────────

function InlineRender(props: { nodes: MarkdownNode[]; baseFontSize?: number; baseColor?: string }) {
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

// ── Model badge (mirrors chat.tsx) ────────────────────────────

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 14;
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: info.color,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>
        {info.initial}
      </Text>
    </Box>
  );
}

// ── Role avatar ───────────────────────────────────────────────

function RoleAvatar(props: { role: string; modelId?: string; size?: number }) {
  const size = props.size || 20;
  if (props.role === 'user') {
    return (
      <Box style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.blueDeep,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.blue,
      }}>
        <Text fontSize={size * 0.45} color={COLORS.blue} style={{ fontWeight: 'bold' }}>U</Text>
      </Box>
    );
  }
  if (props.role === 'system') {
    return (
      <Box style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.grayDeep,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
      }}>
        <Text fontSize={size * 0.45} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>S</Text>
      </Box>
    );
  }
  return <ModelIconBadge modelId={props.modelId || 'unknown'} size={size} />;
}

// ── ToolCallCard (mirrors chat.tsx) ───────────────────────────

export function ToolCallCard(props: { exec: ToolExecution }) {
  const execItem = props.exec;
  const statusColor =
    execItem.status === 'completed' ? COLORS.green : execItem.status === 'error' ? COLORS.red : COLORS.blue;
  return (
    <Box style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {execItem.name}
        </Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {execItem.input}
        </Text>
        <Pill label={execItem.status} color={statusColor} borderColor={statusColor} backgroundColor={COLORS.panelRaised} tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.text}>
        {execItem.result}
      </Text>
    </Box>
  );
}

// ── Streaming cursor ──────────────────────────────────────────

function StreamingCursor() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      style={{
        width: 8,
        height: 16,
        backgroundColor: COLORS.blue,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

// ── Markdown node renderer ────────────────────────────────────

function renderMarkdownNodes(nodes: InternalNode[], onCopyCode: (code: string) => void) {
  const result: any[] = [];
  let inlineBuffer: MarkdownNode[] = [];

  function flushInline() {
    if (inlineBuffer.length === 0) return;
    result.push(
      <Row key={result.length} style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <InlineRender nodes={inlineBuffer} />
      </Row>
    );
    inlineBuffer = [];
  }

  for (const node of nodes) {
    if (node.type === 'paragraph') {
      flushInline();
      continue;
    }

    switch (node.type) {
      case 'text':
      case 'bold':
      case 'italic':
      case 'code':
      case 'link':
        inlineBuffer.push(node);
        break;

      case 'codeblock': {
        flushInline();
        result.push(
          <Box
            key={result.length}
            style={{
              borderRadius: 6,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: '#080b10',
              overflow: 'hidden',
            }}
          >
            <Row
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                backgroundColor: COLORS.grayDeep,
                borderBottomWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
                {node.language || 'text'}
              </Text>
              <Pressable onPress={() => onCopyCode(node.content)}>
                <Row style={{ gap: 4, alignItems: 'center' }}>
                  <Glyph icon="copy" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
                  <Text fontSize={9} color={COLORS.textMuted}>
                    Copy
                  </Text>
                </Row>
              </Pressable>
            </Row>
            <Box style={{ padding: 10 }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>
                {node.content}
              </Text>
            </Box>
          </Box>
        );
        break;
      }

      case 'heading': {
        flushInline();
        const headingSize = node.level === 1 ? 18 : node.level === 2 ? 15 : node.level === 3 ? 13 : 11;
        result.push(
          <Text key={result.length} fontSize={headingSize} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {node.content}
          </Text>
        );
        break;
      }

      case 'list': {
        flushInline();
        result.push(
          <Col key={result.length} style={{ gap: 4, paddingLeft: 4 }}>
            {node.items.map((item, idx) => (
              <Row key={idx} style={{ gap: 8, alignItems: 'flex-start' }}>
                <Text fontSize={11} color={COLORS.textMuted}>{node.ordered ? `${idx + 1}.` : '•'}</Text>
                <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 1 }}>
                  <InlineRender nodes={parseInline(item)} />
                </Row>
              </Row>
            ))}
          </Col>
        );
        break;
      }

      case 'quote': {
        flushInline();
        result.push(
          <Box
            key={result.length}
            style={{
              paddingLeft: 10,
              borderLeftWidth: 3,
              borderColor: COLORS.blue,
              marginLeft: 4,
            }}
          >
            <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <InlineRender nodes={parseInline(node.content)} baseColor={COLORS.textMuted} />
            </Row>
          </Box>
        );
        break;
      }

      case 'rule': {
        flushInline();
        result.push(<Box key={result.length} style={{ height: 1, backgroundColor: COLORS.border }} />);
        break;
      }
    }
  }

  flushInline();
  return result;
}

// ── ChatMessage ───────────────────────────────────────────────

export function ChatMessage(props: {
  message: Message;
  index: number;
  isLast: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  compact?: boolean;
  isStreaming?: boolean;
}) {
  const { message, isLast, onCopy, onRetry, onDelete, onEdit, compact, isStreaming } = props;
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [hovered, setHovered] = useState(false);

  const mdNodes = useMemo(() => parseMarkdownInternal(message.text || ''), [message.text]);

  function handleCopyMessage() {
    copyToClipboard(message.text || '');
    if (onCopy) onCopy();
  }

  function handleCopyCode(code: string) {
    copyToClipboard(code);
  }

  return (
    <Col
      style={{ gap: 6 }}
      onHoverEnter={() => setHovered(true)}
      onHoverExit={() => setHovered(false)}
    >
      {/* Header */}
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <RoleAvatar role={message.role} modelId={message.model} size={20} />
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {isUser ? 'You' : isAssistant ? 'Agent' : 'System'}
        </Text>
        {hovered || compact ? (
          <Text fontSize={9} color={COLORS.textDim}>
            {message.time}
          </Text>
        ) : null}
        {message.mode ? <Pill label={message.mode} color={COLORS.blue} tiny={true} /> : null}
        {isAssistant && message.model ? (
          <Row style={{ alignItems: 'center', gap: 4 }}>
            <ModelIconBadge modelId={message.model} />
            <Pill label={message.model} color={COLORS.textMuted} tiny={true} />
          </Row>
        ) : null}
        {hovered ? (
          <Pressable onPress={handleCopyMessage}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Glyph icon="copy" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
              <Text fontSize={9} color={COLORS.textDim}>Copy</Text>
            </Row>
          </Pressable>
        ) : null}
      </Row>

      {/* Content */}
      <Box
        style={{
          padding: compact ? 8 : 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isUser ? '#1e3a5f' : '#1c2834',
          backgroundColor: isUser ? '#0f1724' : '#0d1117',
          gap: 8,
        }}
      >
        <Col style={{ gap: 6 }}>
          {renderMarkdownNodes(mdNodes, handleCopyCode)}
          {isStreaming ? (
            <Row style={{ alignItems: 'center' }}>
              <StreamingCursor />
            </Row>
          ) : null}
        </Col>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 ? (
          <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {message.attachments.map((attachment) => (
              <Pill key={attachment.id} label={attachment.name} color={COLORS.blue} tiny={true} />
            ))}
          </Row>
        ) : null}

        {/* Tool snapshots */}
        {message.toolSnapshot && message.toolSnapshot.length > 0 ? (
          <Col style={{ gap: 8, marginTop: 4 }}>
            {message.toolSnapshot.map((execItem) => (
              <ToolCallCard key={execItem.id} exec={execItem} />
            ))}
          </Col>
        ) : null}
      </Box>

      {/* Actions */}
      {isLast && (
        <Row style={{ gap: 10, alignItems: 'center', paddingLeft: 4 }}>
          <Pressable onPress={handleCopyMessage}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Glyph icon="copy" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
              <Text fontSize={9} color={COLORS.textDim}>
                Copy
              </Text>
            </Row>
          </Pressable>
          {isAssistant && onRetry ? (
            <Pressable onPress={onRetry}>
              <Row style={{ gap: 4, alignItems: 'center' }}>
                <Glyph icon="refresh" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
                <Text fontSize={9} color={COLORS.textDim}>
                  Retry
                </Text>
              </Row>
            </Pressable>
          ) : null}
          {isUser && onEdit ? (
            <Pressable onPress={onEdit}>
              <Row style={{ gap: 4, alignItems: 'center' }}>
                <Glyph icon="edit" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
                <Text fontSize={9} color={COLORS.textDim}>
                  Edit
                </Text>
              </Row>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete}>
              <Row style={{ gap: 4, alignItems: 'center' }}>
                <Glyph icon="trash" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
                <Text fontSize={9} color={COLORS.textDim}>
                  Delete
                </Text>
              </Row>
            </Pressable>
          ) : null}
        </Row>
      )}
    </Col>
  );
}
