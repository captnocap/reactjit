import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { type ControlTone, toneColor } from './controlsSpecimenTheme';

export type SpecColumnProps = {
  head: string;
  value: string;
  tail: string;
  tone?: ControlTone;
};

export function SpecColumn({
  head,
  value,
  tail,
  tone = 'accent',
}: SpecColumnProps) {
  const color = toneColor(tone);
  return (
    <AtomFrame width={120} padding={10} gap={6} borderColor={color}>
      <Mono color={color}>{head}</Mono>
      <Body fontSize={20} color={color}>{value}</Body>
      <Mono>{tail}</Mono>
    </AtomFrame>
  );
}
