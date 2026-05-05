import { useState } from 'react';
import { Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { ChevronDown, ChevronRight } from '@reactjit/runtime/icons/icons';
import { Icon } from '@reactjit/runtime/icons/Icon';
import { MarkableLine } from './MarkableText';
import { StepCardShell, TranscriptTurnShell } from './TranscriptFlow';
import type { SignalHighlightProps } from './TripwireMenu';
import { CHAT_CARD } from './tokens';
import { classifiers as S } from '@reactjit/core';

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
        <S.TypeBody key={`${line}-${index}`} style={{ color }}>
          {line}
        </S.TypeBody>
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
        <S.InlineX3>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.orange }}>{block.author}</Text>
          {block.meta ? <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>{block.meta}</Text> : null}
        </S.InlineX3>
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
        <Pressable onPress={() => setOpen(!open)} style={{ alignSelf: 'stretch' }}>
          <S.InlineX5Between>
            <S.InlineX3>
              <Icon icon={open ? ChevronDown : ChevronRight} size={12} color={CHAT_CARD.orange} strokeWidth={2.2} />
              <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.orange }}>
                {block.title}
              </Text>
            </S.InlineX3>
            <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.faint }}>{block.timer}</Text>
          </S.InlineX5Between>
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
          backgroundColor: 'theme:bg',
          borderWidth: 1,
          borderColor: 'theme:rule',
          borderRadius: 4,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: 'theme:blue' }}>{block.title}</Text>
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
          backgroundColor: 'theme:bg',
          borderWidth: 1,
          borderColor: 'theme:rule',
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
            backgroundColor: 'theme:bg2',
          }}
        >
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: 'theme:blue' }}>{block.title}</Text>
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
                  backgroundColor: line.prefix === '-' ? 'theme:bg2' : line.prefix === '+' ? 'theme:bg2' : 'theme:bg',
                }}
              >
                <Text style={{ width: 8, fontFamily: 'monospace', fontSize: 9, color }}>{line.prefix}</Text>
                <S.TypeCaption style={{ color }}>{line.text}</S.TypeCaption>
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
