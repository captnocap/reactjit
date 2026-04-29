import type { ReactNode } from 'react';
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';

export const DEX_COLORS = {
  bg: '#0e0b09',
  bg1: '#14100d',
  bg2: '#1a1511',
  ink: '#f2e8dc',
  inkDim: '#b8a890',
  inkDimmer: '#7a6e5d',
  ghost: '#4a4238',
  rule: '#3a2a1e',
  ruleBright: '#8a4a20',
  accent: '#d26a2a',
  ok: '#6aa390',
  warn: '#d6a54a',
  flag: '#e14a2a',
  blue: '#5a8bd6',
  lilac: '#8a7fd4',
};

export type DexFrameProps = {
  id?: string;
  title?: string;
  right?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
};

export function DexFrame({
  id = 'DEX',
  title = 'data explorer',
  right,
  footer,
  children,
  width = '100%',
  height = 260,
}: DexFrameProps) {
  return (
    <Col
      style={{
        width,
        height,
        backgroundColor: DEX_COLORS.bg,
        borderWidth: 1,
        borderColor: DEX_COLORS.ruleBright,
        overflow: 'hidden',
      }}
    >
      <Row
        style={{
          height: 28,
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 10,
          borderBottomWidth: 1,
          borderColor: DEX_COLORS.rule,
          backgroundColor: DEX_COLORS.bg1,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: DEX_COLORS.accent }}>{id}</Text>
        <Text style={{ fontSize: 10, color: DEX_COLORS.inkDim, textTransform: 'uppercase' }}>{title}</Text>
        <Box style={{ flex: 1 }} />
        {right}
      </Row>
      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
      {footer ? (
        <Row
          style={{
            height: 26,
            alignItems: 'center',
            paddingLeft: 10,
            paddingRight: 10,
            borderTopWidth: 1,
            borderColor: DEX_COLORS.rule,
            backgroundColor: DEX_COLORS.bg1,
          }}
        >
          {footer}
        </Row>
      ) : null}
    </Col>
  );
}
