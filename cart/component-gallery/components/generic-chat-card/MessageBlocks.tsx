import { useState } from 'react';
import { Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { MarkableLine } from './MarkableText';
import { StepCardShell, TranscriptTurnShell } from './TranscriptFlow';
import type { SignalHighlightProps } from './TripwireMenu';
import { CHAT_CARD } from './tokens';

export type DiffLine = {
  prefix: '-' | '+' | ' ';
  text: string;
};

export type TranscriptBlock =
  | { kind: 'user'; author: string; lines: string[] }
  | { kind: 'agent'; id: string; author: string; meta?: string; lines: string[]; markable?: boolean }
  | { kind: 'thinking'; title: string; timer: string; lines: string[] }
  | { kind: 'tool'; title: string; meta: string; command: string }
  | { kind: 'diff'; title: string; meta: string; lines: DiffLine[] };

function Lines({ lines, color = CHAT_CARD.text }: { lines: string[]; color?: string }) {
  return (
    <Col style={{ gap: 3 }}>
      {lines.map((line, index) => (
        <Text key={`${line}-${index}`} style={{ fontFamily: 'monospace', fontSize: 10, color }}>
          {line}
        </Text>
      ))}
    </Col>
  );
}

type SignalControls = {
  openSignalId?: string | null;
  onToggleSignal?: (signal: SignalHighlightProps) => void;
  connectTop?: boolean;
  showConnector?: boolean;
};

export function UserMessageBlock({
  block,
  connectTop = false,
  showConnector = false,
}: {
  block: Extract<TranscriptBlock, { kind: 'user' }>;
} & SignalControls) {
  return (
    <TranscriptTurnShell tone="user" connectTop={connectTop} showConnector={showConnector}>
      <Col style={{ gap: 5 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.cyan }}>{block.author}</Text>
        <Lines lines={block.lines} />
      </Col>
    </TranscriptTurnShell>
  );
}

export function AgentMessageBlock({
  block,
  openSignalId,
  onToggleSignal,
  connectTop = false,
  showConnector = false,
}: {
  block: Extract<TranscriptBlock, { kind: 'agent' }>;
} & SignalControls) {
  return (
    <TranscriptTurnShell tone="agent" connectTop={connectTop} showConnector={showConnector}>
      <Col style={{ gap: 5 }}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.gold }}>{block.author}</Text>
          {block.meta ? <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>{block.meta}</Text> : null}
        </Row>
        {block.markable ? (
          <Col style={{ gap: 3 }}>
            {block.lines.map((line, index) => (
              <MarkableLine
                key={`${block.id}-${index}`}
                blockId={block.id}
                line={line}
                lineIndex={index}
                openSignalId={openSignalId}
                onToggleSignal={onToggleSignal}
              />
            ))}
          </Col>
        ) : (
          <Lines lines={block.lines} />
        )}
      </Col>
    </TranscriptTurnShell>
  );
}

export function ThinkingBlock({
  block,
  connectTop = false,
  showConnector = false,
}: {
  block: Extract<TranscriptBlock, { kind: 'thinking' }>;
} & SignalControls) {
  const [open, setOpen] = useState(true);

  return (
    <TranscriptTurnShell tone="thinking" connectTop={connectTop} showConnector={showConnector}>
      <Col style={{ gap: 5 }}>
        <Pressable onPress={() => setOpen(!open)} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.gold }}>
            {open ? 'v' : '>'} {block.title}  {block.timer}
          </Text>
        </Pressable>
        {open ? <Lines lines={block.lines} color={CHAT_CARD.muted} /> : null}
      </Col>
    </TranscriptTurnShell>
  );
}

export function ToolExecutionBlock({
  block,
  connectTop = false,
  showConnector = false,
}: {
  block: Extract<TranscriptBlock, { kind: 'tool' }>;
} & SignalControls) {
  return (
    <StepCardShell color={CHAT_CARD.violet} connectTop={connectTop} showConnector={showConnector} badgeName="terminal">
      <Col
        style={{
          gap: 7,
          padding: 8,
          backgroundColor: '#151a2b',
          borderWidth: 1,
          borderColor: '#353d5f',
          borderRadius: 4,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: '#9eb4ff' }}>{block.title}</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>{block.meta}</Text>
        </Row>
        <Text style={{ fontFamily: 'monospace', fontSize: 9, color: CHAT_CARD.mint }}>{block.command}</Text>
      </Col>
    </StepCardShell>
  );
}

export function DiffBlock({
  block,
  connectTop = false,
  showConnector = false,
}: {
  block: Extract<TranscriptBlock, { kind: 'diff' }>;
} & SignalControls) {
  return (
    <StepCardShell color={CHAT_CARD.pink} connectTop={connectTop} showConnector={showConnector} badgeName="braces">
      <Col
        style={{
          gap: 0,
          backgroundColor: '#151a2b',
          borderWidth: 1,
          borderColor: '#353d5f',
          borderRadius: 4,
        }}
      >
        <Row
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            backgroundColor: '#222842',
          }}
        >
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: '#9eb4ff' }}>{block.title}</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>{block.meta}</Text>
        </Row>
        <Col style={{ gap: 0 }}>
          {block.lines.map((line, index) => {
            const color = line.prefix === '-' ? CHAT_CARD.pink : line.prefix === '+' ? CHAT_CARD.mint : CHAT_CARD.muted;
            return (
              <Row
                key={`${line.prefix}-${index}`}
                style={{
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  gap: 7,
                  backgroundColor: line.prefix === '-' ? '#351d35' : line.prefix === '+' ? '#19362f' : '#151a2b',
                }}
              >
                <Text style={{ width: 8, fontFamily: 'monospace', fontSize: 9, color }}>{line.prefix}</Text>
                <Text style={{ fontFamily: 'monospace', fontSize: 9, color }}>{line.text}</Text>
              </Row>
            );
          })}
        </Col>
      </Col>
    </StepCardShell>
  );
}

export function MessageBlock({ block, openSignalId, onToggleSignal, connectTop = false, showConnector = false }: { block: TranscriptBlock } & SignalControls) {
  if (block.kind === 'user') return <UserMessageBlock block={block} connectTop={connectTop} showConnector={showConnector} />;
  if (block.kind === 'agent') return <AgentMessageBlock block={block} openSignalId={openSignalId} onToggleSignal={onToggleSignal} connectTop={connectTop} showConnector={showConnector} />;
  if (block.kind === 'thinking') return <ThinkingBlock block={block} connectTop={connectTop} showConnector={showConnector} />;
  if (block.kind === 'tool') return <ToolExecutionBlock block={block} connectTop={connectTop} showConnector={showConnector} />;
  return <DiffBlock block={block} connectTop={connectTop} showConnector={showConnector} />;
}
