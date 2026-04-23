// =============================================================================
// TimeTravel — scrub through recorded events
// =============================================================================
// Presents the event log as a scrub slider with transport controls (jump to
// start, step back, play/pause, step forward, jump to live). While the cursor
// is non-live, the Tree freezes its poll so mutations don't race the cursor.
// Actual state rewind would need reconciler-level hooks that don't exist in
// JSRT yet; for now TimeTravel drives cursor-based highlighting in EventLog
// and blocks fresh tree polls, giving a frozen-in-time view.
//
// User controls: enable/disable toggle (persists), play speed (ms per step).
// Settings respect store.timeTravelEnabled — when off, the tab renders a
// disabled-state explainer instead of the scrubber.
// =============================================================================

const React: any = require('react');
const { useEffect, useRef } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import {
  useInspectorStore,
  setTimeCursor,
  setTimeTravelEnabled,
} from './useInspectorStore';

const SPEED_STEPS = [100, 250, 500, 1000, 2000];

export function TimeTravel() {
  const store = useInspectorStore();
  const playState: [boolean, (v: boolean) => void] = React.useState(false);
  const speedState: [number, (v: number) => void] = React.useState(250);
  const playing = playState[0];
  const setPlaying = playState[1];
  const speedMs = speedState[0];
  const setSpeedMs = speedState[1];
  const timerRef = useRef<any>(null);

  const total = store.events.length;
  const liveIdx = total === 0 ? 0 : total - 1;
  const cursor = store.timeCursor === -1 ? liveIdx : store.timeCursor;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) { try { clearInterval(timerRef.current); } catch {} timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      // read latest via store directly to avoid stale closure
      const s = store;
      const cur = s.timeCursor === -1 ? s.events.length - 1 : s.timeCursor;
      if (cur >= s.events.length - 1) {
        setPlaying(false);
        setTimeCursor(-1);
        return;
      }
      setTimeCursor(cur + 1);
    }, speedMs);
    return () => { if (timerRef.current) { try { clearInterval(timerRef.current); } catch {} timerRef.current = null; } };
  }, [playing, speedMs]);

  if (!store.timeTravelEnabled) {
    return (
      <Box style={{
        padding: 12, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8,
      }}>
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>TimeTravel</Text>
          <Pressable onPress={() => setTimeTravelEnabled(true)} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue,
            backgroundColor: COLORS.blueDeep,
          }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Enable</Text>
          </Pressable>
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>
          TimeTravel freezes the Tree poll and pins the cursor so EventLog rows highlight the event at that point. Turn it on to scrub.
        </Text>
      </Box>
    );
  }

  const atLive = store.timeCursor === -1;

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, gap: 8 }}>
      <Row style={{
        alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: atLive ? COLORS.border : COLORS.orange,
        backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>TimeTravel</Text>
        <Text fontSize={10} color={atLive ? COLORS.green : COLORS.orange}>
          {atLive ? '● live' : '‖ paused'}
        </Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {total === 0 ? 'no events' : `cursor ${cursor + 1} / ${total}`}
        </Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable onPress={() => setTimeTravelEnabled(false)} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
          borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={COLORS.textDim}>disable</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pressable onPress={() => { setPlaying(false); setTimeCursor(0); }} style={btnStyle()}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>⏮</Text>
        </Pressable>
        <Pressable onPress={() => { setPlaying(false); setTimeCursor(Math.max(0, cursor - 1)); }} style={btnStyle()}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>◀</Text>
        </Pressable>
        <Pressable onPress={() => setPlaying(!playing)} style={btnStyle(playing ? COLORS.orange : COLORS.green)}>
          <Text fontSize={11} color={playing ? COLORS.orange : COLORS.green} style={{ fontWeight: 'bold' }}>
            {playing ? '⏸' : '▶'}
          </Text>
        </Pressable>
        <Pressable onPress={() => { setPlaying(false); setTimeCursor(cursor + 1); }} style={btnStyle()}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>▶|</Text>
        </Pressable>
        <Pressable onPress={() => { setPlaying(false); setTimeCursor(-1); }} style={btnStyle()}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>⏭</Text>
        </Pressable>

        <Text fontSize={10} color={COLORS.textDim}>speed</Text>
        {SPEED_STEPS.map((s) => {
          const active = s === speedMs;
          return (
            <Pressable key={s} onPress={() => setSpeedMs(s)} style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={active ? COLORS.blue : COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {s}ms
              </Text>
            </Pressable>
          );
        })}
      </Row>

      <Box style={{
        padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelBg,
      }}>
        <Row style={{ gap: 4, alignItems: 'center' }}>
          {total === 0 ? (
            <Text fontSize={10} color={COLORS.textDim}>Record some events to scrub.</Text>
          ) : (
            store.events.map((e, idx) => {
              const hit = idx === cursor;
              return (
                <Pressable key={e.id} onPress={() => { setPlaying(false); setTimeCursor(idx); }} style={{
                  width: 6, height: 18,
                  backgroundColor: hit ? COLORS.blue : COLORS.borderSoft,
                  borderRadius: 1,
                }} />
              );
            })
          )}
        </Row>
      </Box>
    </Col>
  );
}

function btnStyle(tone?: string) {
  return {
    width: 32, height: 26, borderRadius: TOKENS.radiusSm, borderWidth: 1,
    borderColor: tone || COLORS.border,
    backgroundColor: COLORS.panelAlt,
    justifyContent: 'center' as any, alignItems: 'center' as any,
  };
}
