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
        width: '100%',
        minWidth: 0,
        gap: 0,
        backgroundColor: CHAT_CARD.panelDeep,
        borderWidth: 1,
        borderColor: CHAT_CARD.borderSoft,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <S.CardHeader style={{ width: '100%', minWidth: 0 }}>
        <S.InlineX4Center style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, overflow: 'hidden', paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7 }}>
          <ProgressMeter progress={progress} label={rate} />
          <TelemetryDivider />
          <StuckAlert label={alert} />
        </S.InlineX4Center>
        <Box style={{ flexShrink: 0, paddingRight: 10 }}>
          <KillSwitch />
        </Box>
      </S.CardHeader>
      <S.CardHeader style={{ width: '100%', minWidth: 0, overflow: 'hidden', paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderTopWidth: 1, borderColor: 'theme:rule' }}>
        <TelemetryStats state={state} time={time} />
        <SentimentControls />
      </S.CardHeader>
    </Col>
  );
}
