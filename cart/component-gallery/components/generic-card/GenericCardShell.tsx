import { Box, Col } from '@reactjit/runtime/primitives';
import { GENERIC_CARD } from './genericCardShared';

export type GenericCardShellProps = {
  children?: any;
  width?: number;
};

function CornerFrame() {
  return (
    <Box
      style={{
        position: 'absolute',
        left: 10,
        top: 16,
        right: 10,
        bottom: 10,
        borderRadius: 4,
        borderWidth: 0,
        borderColor: GENERIC_CARD.frameColor,
        borderDash: [44, 108],
        borderDashWidth: 2,
        borderFlowSpeed: 18,
      }}
    />
  );
}

export function GenericCardShell({
  children,
  width = GENERIC_CARD.width,
}: GenericCardShellProps) {
  return (
    <Col
      style={{
        position: 'relative',
        width,
        backgroundColor: GENERIC_CARD.surface,
        borderWidth: 1,
        borderColor: GENERIC_CARD.borderColor,
        borderRadius: 6,
      }}
    >
      <Box
        style={{
          height: 6,
          backgroundColor: GENERIC_CARD.topBarColor,
          borderTopLeftRadius: 5,
          borderTopRightRadius: 5,
        }}
      />
      <CornerFrame />
      <Col style={{ padding: 18, paddingTop: 16, gap: 13 }}>{children}</Col>
    </Col>
  );
}
