import { Col, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, StatPair, VerticalSpine } from './controlsSpecimenParts';
import { CTRL, type ControlTone } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type MarginaliaStat = {
  label: string;
  value: string;
};

export type MarginaliaPanelProps = {
  spine?: string;
  title?: string;
  body?: string;
  stats?: MarginaliaStat[];
  tone?: ControlTone;
};

const DEFAULT_STATS: MarginaliaStat[] = [
  { label: 'STATUS', value: 'ACTIVE' },
  { label: 'SCOPE', value: 'W·02' },
  { label: 'SINCE', value: '14:07Z' },
];

export function MarginaliaPanel({
  spine = '§ 02 · ENFORCE',
  title = 'Rat lock discipline',
  body = 'Workers that persistently flag suspicious tool usage are quarantined until the spec anchor is re-affirmed by the operator.',
  stats = DEFAULT_STATS,
  tone = 'accent',
}: MarginaliaPanelProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={spine} tone={tone} />
      <AtomFrame width={236} padding={12} gap={8}>
        <Body fontSize={14}>{title}</Body>
        <Body fontSize={11} color={CTRL.inkDim}>{body}</Body>
        <Row style={{ gap: 14, flexWrap: 'wrap' }}>
          {stats.map((stat) => (
            <StatPair key={stat.label} label={stat.label} value={stat.value} tone={tone} />
          ))}
        </Row>
      </AtomFrame>
    </S.InlineX4>
  );
}
