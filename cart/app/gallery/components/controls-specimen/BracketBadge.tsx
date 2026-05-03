import { Row } from '@reactjit/runtime/primitives';
import { Mono } from './controlsSpecimenParts';
import { type ControlTone, toneColor } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type BracketBadgeProps = {
  left?: string;
  right?: string;
  value: string;
  tone?: ControlTone;
};

export function BracketBadge({
  left = '[',
  right = ']',
  value,
  tone = 'accent',
}: BracketBadgeProps) {
  const color = toneColor(tone);
  return (
    <S.InlineX2>
      <Mono color={color} fontSize={11}>{left}</Mono>
      <Mono color={color} fontSize={11} fontWeight="bold">{value}</Mono>
      <Mono color={color} fontSize={11}>{right}</Mono>
    </S.InlineX2>
  );
}
