import { Col, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from './controlsSpecimenParts';
import { classifiers as S } from '@reactjit/core';

export type SideSpineCrumbsProps = {
  spineLabel?: string;
  crumbs?: string[];
};

const DEFAULT_CRUMBS = ['cart', 'app', 'gallery', 'controls-specimen', 'AxisReadout.tsx'];

export function SideSpineCrumbs({
  spineLabel = 'SPEC · FS',
  crumbs = DEFAULT_CRUMBS,
}: SideSpineCrumbsProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={spineLabel} tone="accent" />
      <AtomFrame width={244} padding={10} gap={6}>
        {crumbs.map((crumb, index) => (
          <S.StackX1 key={`${crumb}-${index}`}>
            <Mono>{index === 0 ? 'ROOT' : `LEVEL ${index}`}</Mono>
            <Body fontSize={11}>{crumb}</Body>
          </S.StackX1>
        ))}
      </AtomFrame>
    </S.InlineX4>
  );
}
