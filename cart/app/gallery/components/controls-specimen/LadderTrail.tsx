import { Box, Col, Row } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type LadderTrailStep = {
  label: string;
  current?: boolean;
};

export type LadderTrailProps = {
  steps?: LadderTrailStep[];
};

const DEFAULT_STEPS: LadderTrailStep[] = [
  { label: 'intake' },
  { label: 'rewrite' },
  { label: 'verify', current: true },
  { label: 'ship' },
];

export function LadderTrail({
  steps = DEFAULT_STEPS,
}: LadderTrailProps) {
  return (
    <S.StackX3>
      {steps.map((step, index) => (
        <S.InlineX4Center key={`${step.label}-${index}`}>
          <S.StackX1Center>
            {index > 0 ? <Box style={{ width: 1, height: 8, backgroundColor: CTRL.rule }} /> : <Box style={{ width: 1, height: 2 }} />}
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step.current ? CTRL.accent : CTRL.rule }} />
            {index < steps.length - 1 ? <Box style={{ width: 1, height: 8, backgroundColor: CTRL.rule }} /> : <Box style={{ width: 1, height: 2 }} />}
          </S.StackX1Center>
          <Body fontSize={11} color={step.current ? CTRL.ink : CTRL.inkDim}>{step.label}</Body>
        </S.InlineX4Center>
      ))}
      <Mono color={CTRL.inkGhost}>trail chronology</Mono>
    </S.StackX3>
  );
}
