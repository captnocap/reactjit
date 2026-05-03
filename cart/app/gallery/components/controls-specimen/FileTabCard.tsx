import { Col, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono, VerticalSpine } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type FileTabMeta = {
  label: string;
  value: string;
};

export type FileTabCardProps = {
  leaf?: string;
  title?: string;
  meta?: FileTabMeta[];
  tone?: ControlTone;
};

const DEFAULT_META: FileTabMeta[] = [
  { label: 'OWNER', value: 'core' },
  { label: 'v', value: '2.1' },
  { label: 'TOUCHED', value: '14:02Z' },
];

export function FileTabCard({
  leaf = 'SPEC · 01',
  title = 'Spec anchor · primary controls',
  meta = DEFAULT_META,
  tone = 'accent',
}: FileTabCardProps) {
  return (
    <S.InlineX4>
      <VerticalSpine label={leaf} tone={tone} solid={true} minWidth={28} />
      <AtomFrame width={236} padding={12} gap={8}>
        <Body fontSize={14}>{title}</Body>
        <Row style={{ gap: 12, flexWrap: 'wrap' }}>
          {meta.map((item) => (
            <S.StackX1 key={item.label}>
              <Mono>{item.label}</Mono>
              <Body fontSize={11}>{item.value}</Body>
            </S.StackX1>
          ))}
        </Row>
      </AtomFrame>
    </S.InlineX4>
  );
}
