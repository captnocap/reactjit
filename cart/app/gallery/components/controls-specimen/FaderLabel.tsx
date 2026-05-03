import { Col } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export function FaderLabel(props: { label: string; value?: string; accent?: boolean }) {
  return (
    <S.StackX1Center>
      <Body fontSize={11} color={props.accent ? CTRL.accent : CTRL.ink}>
        {props.label}
      </Body>
      {props.value ? <Mono color={CTRL.inkDimmer}>{props.value}</Mono> : null}
    </S.StackX1Center>
  );
}
