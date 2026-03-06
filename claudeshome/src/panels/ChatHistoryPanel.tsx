/**
 * ChatHistoryPanel — browseable, searchable chat turn history.
 *
 * Shows accumulated turns from this session and previous ones.
 * Search filters by user prompt text or any row content.
 */
import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { C } from '../theme';
import { useChatHistory } from '../hooks/useChatHistory';
import type { ChatTurn } from '../hooks/useChatHistory';

const KIND_COLOR: Record<string, string> = {
  user_prompt:  C.accent,
  assistant_text: C.text,
  tool:         C.warning,
  result:       C.textMuted,
  diff:         C.approve,
  error:        C.deny,
  thinking:     C.warning,
  thought_complete: C.textDim,
};

function TurnRow({ turn, onToggleBookmark }: { turn: ChatTurn; onToggleBookmark: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const promptRows = turn.rows.filter(r => r.kind === 'user_prompt');
  const assistantRows = turn.rows.filter(r => r.kind === 'assistant_text');
  const toolCount = turn.rows.filter(r => r.kind === 'tool').length;
  const hasError = turn.rows.some(r => r.kind === 'error');

  const firstPrompt = promptRows[0]?.text ?? '';
  const promptDisplay = firstPrompt.length > 60
    ? firstPrompt.slice(0, 60) + '\u2026'
    : firstPrompt;

  return (
    <Pressable onPress={() => setExpanded(e => !e)} style={{
      borderBottomWidth: 1,
      borderColor: C.border + '44',
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 10,
      paddingRight: 10,
      backgroundColor: expanded ? C.surface + '66' : 'transparent',
    }}>
      {/* Summary row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={(e: any) => { e?.stopPropagation?.(); onToggleBookmark(turn.id); }}>
          <Text style={{ fontSize: 10, color: turn.bookmarked ? C.warning : C.textDim + '44' }}>
            {turn.bookmarked ? '\u2605' : '\u2606'}
          </Text>
        </Pressable>
        <Text style={{ fontSize: 8, color: C.accent }}>{expanded ? '\u25BC' : '\u25B6'}</Text>
        <Box style={{ flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.accent }}>
            {promptDisplay || '(empty prompt)'}
          </Text>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            {assistantRows.length > 0 && (
              <Text style={{ fontSize: 8, color: C.textMuted }}>
                {`${assistantRows.length} lines`}
              </Text>
            )}
            {toolCount > 0 && (
              <Text style={{ fontSize: 8, color: C.warning }}>
                {`${toolCount} tools`}
              </Text>
            )}
            {hasError && (
              <Text style={{ fontSize: 8, color: C.deny }}>{'ERR'}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Expanded detail */}
      {expanded && (
        <Box style={{ marginTop: 6, gap: 2, paddingLeft: 12 }}>
          {turn.rows.slice(0, 30).map((row, i) => {
            const color = KIND_COLOR[row.kind] ?? C.textDim;
            const display = row.text.length > 80
              ? row.text.slice(0, 80) + '\u2026'
              : row.text;
            if (!display.trim()) return null;
            return (
              <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Box style={{ width: 42, flexShrink: 0 }}>
                  <Text style={{ fontSize: 8, color: color + 'aa', fontWeight: 'bold' }}>
                    {row.kind.slice(0, 7)}
                  </Text>
                </Box>
                <Text style={{ fontSize: 9, color, flexGrow: 1 }}>{display}</Text>
              </Box>
            );
          })}
          {turn.rows.length > 30 && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {`\u2026 ${turn.rows.length - 30} more rows`}
            </Text>
          )}
        </Box>
      )}
    </Pressable>
  );
}

export function ChatHistoryPanel() {
  const { turns, totalTurns, bookmarkCount, query, setQuery, toggleBookmark, clearHistory } = useChatHistory();

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'CHAT HISTORY'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>{`${totalTurns} turns`}</Text>
          {bookmarkCount > 0 && (
            <Text style={{ fontSize: 8, color: C.warning }}>{`\u2605 ${bookmarkCount}`}</Text>
          )}
        </Box>
        <Pressable onPress={clearHistory} style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          borderWidth: 1, borderColor: C.border, borderRadius: 4,
        }}>
          <Text style={{ fontSize: 8, color: C.textMuted }}>{'clear'}</Text>
        </Pressable>
      </Box>

      {/* Search bar */}
      <Box style={{
        paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
        borderBottomWidth: 1, borderColor: C.border + '44', flexShrink: 0,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <Text style={{ fontSize: 10, color: C.textDim }}>{'/'}</Text>
        <TextInput
          placeholder="search turns\u2026"
          placeholderColor={C.textMuted}
          onLiveChange={setQuery}
          liveChangeDebounce={200}
          style={{
            flexGrow: 1,
            fontSize: 10,
            color: C.text,
            backgroundColor: 'transparent',
            height: 22,
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Text style={{ fontSize: 9, color: C.textMuted }}>{'x'}</Text>
          </Pressable>
        )}
      </Box>

      {/* Turn list */}
      <ScrollView style={{ flexGrow: 1 }}>
        {turns.length === 0 ? (
          <Box style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>
              {totalTurns === 0 ? 'No turns recorded yet.' : 'No matches.'}
            </Text>
          </Box>
        ) : (
          turns.map(turn => <TurnRow key={turn.id} turn={turn} onToggleBookmark={toggleBookmark} />)
        )}
      </ScrollView>
    </Box>
  );
}
