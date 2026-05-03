import { Col } from '@reactjit/runtime/primitives';
import { GenericCardDataRow } from './GenericCardDataRow';
import { GenericCardHeader } from './GenericCardHeader';
import { GenericCardMetricBar } from './GenericCardMetricBar';
import { GenericCardShell } from './GenericCardShell';
import { GenericCardSketchPanel } from './GenericCardSketchPanel';
import { GenericCardTitleBlock } from './GenericCardTitleBlock';
import {
  DEFAULT_GENERIC_CARD_METRICS,
  DEFAULT_GENERIC_CARD_ROWS,
  DEFAULT_GENERIC_CARD_SKETCH_LINES,
  GENERIC_CARD,
  type GenericCardMetric,
  type GenericCardProps,
  type GenericCardRow,
} from './genericCardShared';

export type { GenericCardMetric, GenericCardProps, GenericCardRow } from './genericCardShared';

export function GenericCard({
  eyebrow,
  score,
  title,
  subtitle,
  rows = DEFAULT_GENERIC_CARD_ROWS,
  metrics = DEFAULT_GENERIC_CARD_METRICS,
  sketchLines = DEFAULT_GENERIC_CARD_SKETCH_LINES,
}: GenericCardProps) {
  return (
    <GenericCardShell>
      <GenericCardHeader eyebrow={eyebrow} score={score} />
      <GenericCardTitleBlock title={title} subtitle={subtitle} />
      <GenericCardSketchPanel lines={sketchLines} />
      <Col style={{ gap: 7 }}>
        {metrics.map((metric) => (
          <GenericCardMetricBar key={metric.label} metric={metric} />
        ))}
      </Col>
      <Col
        style={{
          padding: 10,
          gap: 7,
          backgroundColor: GENERIC_CARD.surface,
          borderWidth: 1,
          borderColor: GENERIC_CARD.dataPanelBorder,
          borderRadius: 4,
        }}
      >
        {rows.map((row, index) => (
          <GenericCardDataRow key={`${row.label}-${index}`} row={row} index={index} />
        ))}
      </Col>
    </GenericCardShell>
  );
}
