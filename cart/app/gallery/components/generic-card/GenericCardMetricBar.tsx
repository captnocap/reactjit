import { Box, Row, Text } from '@reactjit/runtime/primitives';
import {
  DEFAULT_GENERIC_CARD_METRICS,
  GENERIC_CARD,
  GenericCardMetric,
  clampGenericCardFill,
} from './genericCardShared';
import { classifiers as S } from '@reactjit/core';

export type GenericCardMetricBarProps = {
  metric?: GenericCardMetric;
};

export function GenericCardMetricBar({
  metric = DEFAULT_GENERIC_CARD_METRICS[0],
}: GenericCardMetricBarProps) {
  const fillWidth = Math.round(clampGenericCardFill(metric.fill) * GENERIC_CARD.trackWidth);

  return (
    <S.InlineX5Between>
      <Text style={{ width: 78, fontFamily: 'monospace', fontSize: 10, color: 'theme:inkDim' }}>{metric.label}</Text>
      <Box
        style={{
          width: GENERIC_CARD.trackWidth,
          height: 8,
          backgroundColor: GENERIC_CARD.metricTrack,
          borderWidth: 1,
          borderColor: GENERIC_CARD.metricTrackBorder,
        }}
      >
        <Box style={{ width: fillWidth, height: 6, backgroundColor: metric.color }} />
      </Box>
      <Text style={{ width: 38, fontFamily: 'monospace', fontSize: 10, color: GENERIC_CARD.bodyText }}>{metric.value}</Text>
    </S.InlineX5Between>
  );
}
