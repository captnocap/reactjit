import { Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, SparkBars, VerticalSpine } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type ScaleLabelCardProps = {
  title?: string;
  leftUnit?: string;
  rightUnit?: string;
  values?: number[];
};

export function ScaleLabelCard({
  title = 'Latency · p95',
  leftUnit = 'N\nM',
  rightUnit = 'E\nV\nL\n \nS\nM',
  values = [0.36, 0.52, 0.24, 0.58, 0.42, 0.72, 0.64, 0.8],
}: ScaleLabelCardProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={leftUnit} tone="neutral" minWidth={24} />
      <AtomFrame width={256} padding={12} gap={10}>
        <Body fontSize={14}>{title}</Body>
        <SparkBars values={values} stretch={true} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Mono color={CTRL.inkGhost}>0</Mono>
          <Mono color={CTRL.inkGhost}>t−4</Mono>
          <Mono color={CTRL.inkGhost}>t−2</Mono>
          <Mono color={CTRL.inkGhost}>NOW</Mono>
        </Row>
      </AtomFrame>
      <VerticalSpine label={rightUnit} tone="accent" minWidth={24} />
    </S.InlineX4>
  );
}
