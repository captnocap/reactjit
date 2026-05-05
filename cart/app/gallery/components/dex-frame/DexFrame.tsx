import type { ReactNode } from 'react';
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';

export const DEX_COLORS = {
  bg: 'theme:bg',
  bg1: 'theme:bg1',
  bg2: 'theme:bg2',
  ink: 'theme:ink',
  inkDim: 'theme:inkDim',
  inkDimmer: 'theme:inkDimmer',
  ghost: 'theme:inkGhost',
  rule: 'theme:rule',
  ruleBright: 'theme:ruleBright',
  accent: 'theme:accent',
  ok: 'theme:ok',
  warn: 'theme:warn',
  flag: 'theme:flag',
  blue: 'theme:blue',
  lilac: 'theme:lilac',
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
