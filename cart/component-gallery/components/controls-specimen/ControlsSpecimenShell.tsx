import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export function VerticalText(props: {
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
}) {
  const chars = Array.from(props.text || '');
  return (
    <Col style={{ alignItems: 'center', gap: 0 }}>
      {chars.map((char, index) => (
        <Text
          key={`${char}-${index}`}
          style={{
            fontSize: props.fontSize ?? 8,
            color: props.color ?? CTRL.inkDimmer,
            fontFamily: CTRL.mono,
            fontWeight: props.fontWeight ?? 'normal',
            letterSpacing: props.letterSpacing ?? 1.2,
            lineHeight: (props.fontSize ?? 8) + 1,
          }}
        >
          {char}
        </Text>
      ))}
    </Col>
  );
}

export function SpecimenPage(props: { children: any }) {
  return (
    <Col style={{ width: '100%', paddingLeft: CTRL.pagePadding, paddingRight: CTRL.pagePadding, paddingTop: CTRL.pagePadding, paddingBottom: CTRL.pagePadding, gap: 34, backgroundColor: CTRL.bg }}>
      {props.children}
    </Col>
  );
}

export function SpecimenSection(props: { code: string; title: string; tag?: string; children: any }) {
  return (
    <Col style={{ width: '100%', gap: 10 }}>
      <Row style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <Row style={{ gap: 10, alignItems: 'baseline' }}>
          <Text style={{ fontSize: 9, color: CTRL.accent, fontFamily: CTRL.mono, letterSpacing: 2 }}>{props.code}</Text>
          <Text style={{ fontSize: 18, color: CTRL.ink, fontWeight: '500' }}>{props.title}</Text>
        </Row>
        {props.tag ? <Text style={{ fontSize: 8, color: CTRL.inkDimmer, fontFamily: CTRL.mono, letterSpacing: 1.6, textTransform: 'uppercase' }}>{props.tag}</Text> : null}
      </Row>
      {props.children}
    </Col>
  );
}

export function SpecimenGrid(props: { children: any }) {
  return <Row style={{ width: '100%', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>{props.children}</Row>;
}

export function SpecimenCard(props: {
  width?: number;
  tall?: boolean;
  name: string;
  code: string;
  caption?: string;
  readoutLabel?: string;
  readoutValue?: string;
  children: any;
}) {
  return (
    <Col
      style={{
        width: props.width ?? CTRL.cardMedium,
        minHeight: props.tall ? CTRL.cardTallMinHeight : CTRL.cardMinHeight,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: CTRL.ruleBright,
        backgroundColor: CTRL.bg2,
      }}
    >
      <Col style={{ gap: 3 }}>
        <S.InlineX4BetweenFull>
          <Text style={{ fontSize: 12, color: CTRL.ink, fontWeight: '500' }}>{props.name}</Text>
          <Text style={{ fontSize: 8, color: CTRL.accent, fontFamily: CTRL.mono, letterSpacing: 1.5 }}>{props.code}</Text>
        </S.InlineX4BetweenFull>
        {props.caption ? <Text style={{ fontSize: 8, color: CTRL.inkDimmer, fontFamily: CTRL.mono, letterSpacing: 1.2, textTransform: 'uppercase' }}>{props.caption}</Text> : null}
      </Col>

      <S.Spacer>{props.children}</S.Spacer>

      {props.readoutLabel || props.readoutValue ? (
        <Row style={{ width: '100%', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderColor: CTRL.rule, paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: CTRL.inkDimmer, fontFamily: CTRL.mono, letterSpacing: 1.3, textTransform: 'uppercase' }}>{props.readoutLabel || ''}</Text>
          <Text style={{ fontSize: 9, color: CTRL.accent, fontFamily: CTRL.mono, fontWeight: 'bold' }}>{props.readoutValue || ''}</Text>
        </Row>
      ) : null}
    </Col>
  );
}
