import { useState } from 'react';
import { Box, Col, ScrollView } from '../../../../runtime/primitives';
import { MessageBlock, type TranscriptBlock } from './MessageBlocks';
import { SignalPopoverLayer } from './SignalPopoverLayer';
import type { SignalHighlightProps } from './TripwireMenu';
import { CHAT_CARD } from './tokens';

export function ConsoleTranscript({ blocks, attachment }: { blocks: TranscriptBlock[]; attachment?: any }) {
  const [openSignal, setOpenSignal] = useState<SignalHighlightProps | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 384, height: 300 });

  const toggleSignal = (signal: SignalHighlightProps) => {
    setOpenSignal((current) => (current?.id === signal.id ? null : signal));
  };

  return (
    <Col
      style={{
        position: 'relative',
        flexGrow: 1,
        minHeight: 0,
        backgroundColor: CHAT_CARD.panel,
        borderWidth: 1,
        borderColor: CHAT_CARD.borderSoft,
        borderRadius: 4,
        overflow: 'visible',
      }}
      onLayout={(rect: any) => {
        if (!rect) return;
        setViewport({
          x: Number.isFinite(rect.x) ? rect.x : 0,
          y: Number.isFinite(rect.y) ? rect.y : 0,
          width: Number.isFinite(rect.width) ? rect.width : 384,
          height: Number.isFinite(rect.height) ? rect.height : 300,
        });
      }}
    >
      <Box style={{ flexGrow: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flexGrow: 1, minHeight: 0, padding: 11 }}
          showScrollbar={false}
          onScroll={(payload: any) => {
            if (Number.isFinite(payload?.scrollY) && openSignal) setOpenSignal(null);
          }}
        >
          <Col style={{ gap: 0 }}>
            {blocks.map((block, index) => (
              <MessageBlock
                key={`${block.kind}-${index}`}
                block={block}
                openSignalId={openSignal?.id ?? null}
                onToggleSignal={toggleSignal}
                connectTop={index > 0}
                showConnector={index < blocks.length - 1}
              />
            ))}
          </Col>
        </ScrollView>
      </Box>
      {attachment ? (
        <Box
          style={{
            borderTopWidth: 1,
            borderColor: '#3d4668',
            backgroundColor: CHAT_CARD.panelDeep,
          }}
        >
          {attachment}
        </Box>
      ) : null}
      {openSignal ? <SignalPopoverLayer anchor={openSignal.anchor} selected={openSignal.selected} viewport={viewport} /> : null}
    </Col>
  );
}
