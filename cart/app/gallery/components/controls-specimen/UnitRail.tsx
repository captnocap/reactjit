import { Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from './controlsSpecimenParts';
import { classifiers as S } from '@reactjit/core';

export type UnitRailProps = {
  unit: string;
  value: string;
  sub: string;
};

export function UnitRail({
  unit,
  value,
  sub,
}: UnitRailProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={unit} tone="accent" />
      <AtomFrame width={216} padding={10} gap={4}>
        <Body fontSize={18}>{value}</Body>
        <Mono>{sub}</Mono>
      </AtomFrame>
    </S.InlineX4>
  );
}
