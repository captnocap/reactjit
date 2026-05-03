import { Col, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type SideTabCardProps = {
  spine: string;
  title: string;
  value: string;
  sub: string;
  tone?: ControlTone;
};

export function SideTabCard({
  spine,
  title,
  value,
  sub,
  tone = 'accent',
}: SideTabCardProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={spine} tone={tone} />
      <AtomFrame width={220} padding={10} gap={4}>
        <Mono>{title}</Mono>
        <Body fontSize={17}>{value}</Body>
        <Mono>{sub}</Mono>
      </AtomFrame>
    </S.InlineX4>
  );
}
