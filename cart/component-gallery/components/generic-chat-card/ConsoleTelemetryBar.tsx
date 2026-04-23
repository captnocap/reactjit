import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { KillSwitch } from './KillSwitch';
import { ProgressMeter } from './ProgressMeter';
import { SentimentControls } from './SentimentControls';
import { StuckAlert } from './StuckAlert';
import { TelemetryStats } from './TelemetryStats';
import { CHAT_CARD } from './tokens';

export type ConsoleTelemetryProps = {
  progress: number;
  rate: string;
  time: string;
  state: string;
  alert: string;
};

export function ConsoleTelemetryBar({ progress, rate, time, state, alert }: ConsoleTelemetryProps) {
  return (
    <Col
      style={{
        gap: 0,
        backgroundColor: CHAT_CARD.panelDeep,
        borderWidth: 1,
        borderColor: CHAT_CARD.borderSoft,
        borderRadius: 4,
      }}
    >
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Row style={{ alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7 }}>
          <ProgressMeter progress={progress} label={rate} />
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>|</Text>
          <StuckAlert label={alert} />
        </Row>
        <Box style={{ paddingRight: 10 }}>
          <KillSwitch />
        </Box>
      </Row>
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
          borderTopWidth: 1,
          borderColor: '#3d4668',
        }}
      >
        <TelemetryStats state={state} time={time} />
        <SentimentControls />
      </Row>
    </Col>
  );
}
