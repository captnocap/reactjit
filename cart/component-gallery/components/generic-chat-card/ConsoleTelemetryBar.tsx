import { Box, Col } from '@reactjit/runtime/primitives';
import { KillSwitch } from './KillSwitch';
import { ProgressMeter } from './ProgressMeter';
import { SentimentControls } from './SentimentControls';
import { StuckAlert } from './StuckAlert';
import { TelemetryDivider, TelemetryStats } from './TelemetryStats';
import { CHAT_CARD } from './tokens';
import { classifiers as S } from '@reactjit/core';

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
      <S.CardHeader>
        <S.InlineX4Center style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7 }}>
          <ProgressMeter progress={progress} label={rate} />
          <TelemetryDivider />
          <StuckAlert label={alert} />
        </S.InlineX4Center>
        <Box style={{ paddingRight: 10 }}>
          <KillSwitch />
        </Box>
      </S.CardHeader>
      <S.CardHeader style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderTopWidth: 1, borderColor: '#3a2a1e' }}>
        <TelemetryStats state={state} time={time} />
        <SentimentControls />
      </S.CardHeader>
    </Col>
  );
}
