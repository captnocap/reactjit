import React from 'react';
import { Box, Col, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

type SlideProps = {
  title: string;
  indexLabel: string;
  body?: string;
  notes?: string;
  active?: boolean;
  children?: React.ReactNode;
};

function renderLines(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = String(text || '').split(/\r?\n/);
  let buffer: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    nodes.push(<Text key={`p-${nodes.length}`} fontSize={15} color={COLORS.textBright} style={{ lineHeight: 21 }}>{buffer.join('\n')}</Text>);
    buffer = [];
  };
  const flushCode = () => {
    if (code.length === 0) return;
    nodes.push(
      <Box key={`c-${nodes.length}`} style={{ padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontFamily: 'monospace', lineHeight: 18 }}>{code.join('\n')}</Text>
      </Box>,
    );
    code = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) flushCode();
      else flushBuffer();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushBuffer();
      continue;
    }
    if (/^\s*#{1,3}\s+/.test(line)) {
      flushBuffer();
      nodes.push(<Text key={`h-${nodes.length}`} fontSize={17} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{line.replace(/^\s*#{1,3}\s+/, '')}</Text>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushBuffer();
      nodes.push(<Text key={`b-${nodes.length}`} fontSize={14} color={COLORS.textBright} style={{ lineHeight: 20 }}>{'• ' + line.replace(/^\s*[-*]\s+/, '')}</Text>);
      continue;
    }
    buffer.push(line);
  }

  flushBuffer();
  flushCode();
  return nodes;
}

export function Slide(props: SlideProps) {
  const active = props.active !== false;

  return (
    <Box
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 0,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : COLORS.border,
        borderRadius: 18,
        backgroundColor: active ? COLORS.panelRaised : COLORS.panelBg,
        overflow: 'hidden',
      }}
    >
      <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 16, gap: 14 }}>
        <Col style={{ gap: 4 }}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold', letterSpacing: 0.6 }}>{props.indexLabel}</Text>
          <Text fontSize={28} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
        </Col>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <Col style={{ gap: 12, paddingRight: 8 }}>
            {props.body ? renderLines(props.body) : null}
            {props.children}
          </Col>
        </ScrollView>
        {props.notes ? <Text fontSize={10} color={COLORS.textDim}>{props.notes}</Text> : null}
      </Col>
    </Box>
  );
}
