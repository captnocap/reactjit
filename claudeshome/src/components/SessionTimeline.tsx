/**
 * SessionTimeline — horizontal strip showing conversation turns over time.
 *
 * Each turn = a [dot][bar] pair:
 *   dot  = user prompt marker (small circle)
 *   bar  = assistant response (width proportional to response depth)
 *
 * Bars are color-coded by response character:
 *   tool_heavy → amber   (lots of tool use)
 *   text_heavy → accent  (long text response)
 *   short      → muted   (brief reply)
 *
 * The latest turn always glows in full accent color.
 * Bookmarked turns get a star dot color.
 */
import React, { useMemo } from 'react';
import { Box } from '@reactjit/core';
import { useChatHistory, ChatTurn } from '../hooks/useChatHistory';
import { C } from '../theme';

const STRIP_H  = 22;
const DOT_SIZE = 6;
const DOT_GAP  = 2;
const BAR_H    = 5;
const MIN_FLEX = 0.4;
const MAX_TURNS = 60;

function classifyTurn(turn: ChatTurn): 'tool_heavy' | 'text_heavy' | 'short' {
  const toolCount = turn.rows.filter(r => r.kind === 'tool' || r.kind === 'result').length;
  const textCount = turn.rows.filter(r => r.kind === 'assistant_text').length;
  if (toolCount > 4) return 'tool_heavy';
  if (textCount > 6) return 'text_heavy';
  return 'short';
}

function flexForTurn(turn: ChatTurn): number {
  const depth = turn.rows.filter(r =>
    r.kind === 'assistant_text' || r.kind === 'tool' || r.kind === 'result'
  ).length;
  return Math.max(MIN_FLEX, depth * 0.4);
}

function barColor(kind: ReturnType<typeof classifyTurn>, isLatest: boolean, bookmarked: boolean): string {
  if (bookmarked) return C.approve;
  if (isLatest)   return C.accent;
  if (kind === 'tool_heavy') return C.warning;
  if (kind === 'text_heavy') return C.accentDim;
  return C.textMuted;
}

function dotColor(isLatest: boolean, bookmarked: boolean): string {
  if (bookmarked) return C.approve;
  if (isLatest)   return C.accent;
  return C.textMuted;
}

function TurnSegment({
  turn,
  isLatest,
}: {
  turn: ChatTurn;
  isLatest: boolean;
}) {
  const kind      = classifyTurn(turn);
  const flex      = flexForTurn(turn);
  const bColor    = barColor(kind, isLatest, !!turn.bookmarked);
  const dColor    = dotColor(isLatest, !!turn.bookmarked);
  const barAlpha  = isLatest ? 'dd' : '55';

  return (
    <Box style={{ flexGrow: flex, flexDirection: 'row', alignItems: 'center', minWidth: DOT_SIZE + DOT_GAP }}>
      {/* User prompt dot */}
      <Box style={{
        width:           DOT_SIZE,
        height:          DOT_SIZE,
        borderRadius:    DOT_SIZE / 2,
        backgroundColor: dColor,
        flexShrink:      0,
        marginLeft:      DOT_GAP,
        marginRight:     DOT_GAP,
      }} />
      {/* Assistant response bar */}
      <Box style={{
        flexGrow:        1,
        height:          BAR_H,
        borderRadius:    BAR_H / 2,
        backgroundColor: bColor + barAlpha,
        marginRight:     DOT_GAP,
      }} />
    </Box>
  );
}

export function SessionTimeline() {
  const { turns } = useChatHistory();

  // turns arrives newest-first; reverse for left→right chronology
  const chronological = useMemo(
    () => [...turns].reverse().slice(-MAX_TURNS),
    [turns],
  );

  if (chronological.length === 0) return null;

  return (
    <Box style={{
      flexDirection:   'row',
      height:          STRIP_H,
      borderTopWidth:  1,
      borderColor:     C.border,
      backgroundColor: C.bg,
      alignItems:      'center',
    }}>
      {chronological.map((turn, i) => (
        <TurnSegment
          key={turn.id}
          turn={turn}
          isLatest={i === chronological.length - 1}
        />
      ))}
    </Box>
  );
}
