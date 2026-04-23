import { Box, Col, Row } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

function CornerFrame() {
  const line = CHAT_CARD.violet;

  return (
    <>
      <Box style={{ position: 'absolute', left: 8, top: 14, width: 18, height: 2, backgroundColor: line }} />
      <Box style={{ position: 'absolute', left: 8, top: 14, width: 2, height: 18, backgroundColor: line }} />
      <Box style={{ position: 'absolute', right: 8, top: 14, width: 18, height: 2, backgroundColor: line }} />
      <Box style={{ position: 'absolute', right: 8, top: 14, width: 2, height: 18, backgroundColor: line }} />
      <Box style={{ position: 'absolute', left: 8, bottom: 8, width: 18, height: 2, backgroundColor: line }} />
      <Box style={{ position: 'absolute', left: 8, bottom: 8, width: 2, height: 18, backgroundColor: line }} />
      <Box style={{ position: 'absolute', right: 8, bottom: 8, width: 18, height: 2, backgroundColor: line }} />
      <Box style={{ position: 'absolute', right: 8, bottom: 8, width: 2, height: 18, backgroundColor: line }} />
    </>
  );
}

export function ConsoleCoreContainer({ children }: { children: any }) {
  return <Col style={{ flexGrow: 1, minHeight: 0, padding: 10, gap: 9 }}>{children}</Col>;
}

export function ConsoleTile({
  lane,
  cliff,
  children,
}: {
  lane: any;
  cliff: any;
  children: any;
}) {
  return (
    <Row
      style={{
        width: CHAT_CARD.width,
        height: CHAT_CARD.height,
        alignItems: 'stretch',
      }}
    >
      <Box
        style={{
          width: CHAT_CARD.railWidth,
          paddingTop: 14,
          paddingBottom: 10,
          paddingRight: 4,
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          backgroundColor: 'transparent',
        }}
      >
        {lane}
      </Box>
      <Col
        style={{
          position: 'relative',
          flexGrow: 1,
          minHeight: 0,
          backgroundColor: CHAT_CARD.bg,
          borderWidth: 1,
          borderColor: CHAT_CARD.border,
          borderRadius: 6,
        }}
      >
        <Box style={{ height: 6, backgroundColor: CHAT_CARD.orange }} />
        <CornerFrame />
        <ConsoleCoreContainer>{children}</ConsoleCoreContainer>
      </Col>
      <Box
        style={{
          width: CHAT_CARD.cliffWidth,
          paddingTop: 14,
          paddingBottom: 10,
          paddingLeft: 4,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          backgroundColor: 'transparent',
        }}
      >
        {cliff}
      </Box>
    </Row>
  );
}
