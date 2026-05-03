import { Box, Col, Row } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type ChronologyEvent = {
  ts: string;
  label: string;
  tone?: 'default' | 'flag' | 'current';
};

export type ChronologyTrailProps = {
  events?: ChronologyEvent[];
};

const DEFAULT_EVENTS: ChronologyEvent[] = [
  { ts: '14:02:01', label: 'rat lock · raised' },
  { ts: '14:03:12', label: 'scope · narrowed' },
  { ts: '14:06:44', label: 'operator · active', tone: 'current' },
  { ts: '—', label: 'quarantine · pending' },
];

export function ChronologyTrail({
  events = DEFAULT_EVENTS,
}: ChronologyTrailProps) {
  return (
    <S.StackX3>
      {events.map((event, index) => {
        const color = event.tone === 'flag' ? CTRL.flag : event.tone === 'current' ? CTRL.accent : CTRL.inkDim;
        return (
          <S.InlineX5 key={`${event.ts}-${index}`}>
            <S.StackX1Center>
              <Box style={{ width: 1, height: index === 0 ? 2 : 7, backgroundColor: index === 0 ? 'transparent' : CTRL.rule }} />
              <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
              <Box style={{ width: 1, height: index === events.length - 1 ? 2 : 7, backgroundColor: index === events.length - 1 ? 'transparent' : CTRL.rule }} />
            </S.StackX1Center>
            <Mono color={CTRL.inkDimmer} style={{ width: 62 }}>{event.ts}</Mono>
            <Body fontSize={11} color={color}>{event.label}</Body>
          </S.InlineX5>
        );
      })}
    </S.StackX3>
  );
}
