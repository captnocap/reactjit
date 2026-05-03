import { Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type PrefixDataCardProps = {
  prefix: string;
  headline: string;
  subline: string;
  tone?: ControlTone;
};

export function PrefixDataCard({
  prefix,
  headline,
  subline,
  tone = 'accent',
}: PrefixDataCardProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={prefix} tone={tone} solid={true} minWidth={28} />
      <AtomFrame width={240} padding={10} gap={4}>
        <Body fontSize={13}>{headline}</Body>
        <Mono>{subline}</Mono>
      </AtomFrame>
    </S.InlineX4>
  );
}
