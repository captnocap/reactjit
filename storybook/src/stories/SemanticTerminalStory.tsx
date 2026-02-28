/**
 * SemanticTerminalStory — Semantic CLI classification + playback platform
 *
 * Demonstrates the SemanticTerminal capability across 4 tabs:
 *   Live Demo          — spawns bash, basic classifier, token badge overlay
 *   Recorded Session   — plays back a recording with timeline scrubber
 *   Classifier Compare — same recording through two classifiers side-by-side
 *   Graph Inspector    — live semantic graph tree + state dashboard
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Text, Pressable, ScrollView,
  SemanticTerminal, useSemanticTerminal,
} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  tokenBg: 'rgba(255,255,255,0.06)',
  tokenBorder: 'rgba(255,255,255,0.1)',
  timelineBg: '#1e293b',
  timelineProgress: '#3b82f6',
  timelineThumb: '#60a5fa',
  speedBg: '#334155',
  graphNodeBg: '#1e293b',
  graphEdge: '#475569',
  stateBg: '#0f172a',
  liveGreen: '#3fb950',
  pauseOrange: '#f59e0b',
};

// ── Token color map (same as capability, for badge rendering) ─────────────────

const TOKEN_COLORS: Record<string, string> = {
  user_prompt: '#60a5fa', user_text: '#e2e8f0', assistant_text: '#e2e8f0',
  thinking: '#a78bfa', thought_complete: '#94a3b8', tool: '#eab308',
  result: '#94a3b8', diff: '#4ade80', error: '#f87171',
  banner: '#94a3b8', status_bar: '#64748b', box_drawing: '#334155',
  permission: '#f97316', separator: '#475569', command: '#60a5fa',
  success: '#4ade80', heading: '#f1f5f9', progress: '#38bdf8',
  output: '#cbd5e1', unknown: '#64748b',
};

// ── Shared badge component ────────────────────────────────────────────────────

function TokenBadge({ token }: { token: string }) {
  const color = TOKEN_COLORS[token] || '#64748b';
  return (
    <Box style={{
      backgroundColor: C.tokenBg,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: C.tokenBorder,
      paddingLeft: 5,
      paddingRight: 5,
      paddingTop: 1,
      paddingBottom: 1,
    }}>
      <Text fontSize={8} style={{ color }}>{token}</Text>
    </Box>
  );
}

// ── Pill button ───────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} style={{
      paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
      backgroundColor: active ? (color || c.bgElevated) : 'transparent',
      borderRadius: 4,
    }}>
      <Text fontSize={12} style={{ color: active ? c.text : c.muted }}>{label}</Text>
    </Pressable>
  );
}

// ── Tab 1: Live Demo ──────────────────────────────────────────────────────────

function LiveDemoTab() {
  const c = useThemeColors();
  const st = useSemanticTerminal({
    mode: 'live',
    command: 'bash',
    classifier: 'basic',
    showTokens: true,
    rows: 30,
    cols: 100,
  });

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Info bar */}
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.liveGreen }} />
        <Text fontSize={12} style={{ color: c.text }}>{'Live bash session'}</Text>
        <Text fontSize={10} style={{ color: c.muted }}>{'classifier: basic'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} style={{ color: c.muted }}>
          {`${st.classifiedRows.length} classified rows`}
        </Text>
      </Box>

      {/* Terminal */}
      <Box style={{ flexGrow: 1, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
        <SemanticTerminal {...st.terminalProps} style={{ flexGrow: 1 }} />
      </Box>

      {/* Token legend */}
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Text fontSize={10} style={{ color: c.muted, paddingTop: 2 }}>{'Tokens:'}</Text>
        {['command', 'output', 'error', 'success', 'heading', 'separator', 'progress'].map(t => (
          <TokenBadge key={t} token={t} />
        ))}
      </Box>

      {/* Recent classified rows */}
      <Box style={{ maxHeight: 120, backgroundColor: c.bgElevated, borderRadius: 6, padding: 8 }}>
        <Text fontSize={10} style={{ color: c.muted, marginBottom: 4 }}>
          {'Recent classifications:'}
        </Text>
        <ScrollView style={{ flexGrow: 1 }}>
          {st.classifiedRows.slice(-8).map((row, i) => (
            <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 2 }}>
              <Text fontSize={9} style={{ color: c.muted, width: 24 }}>{`R${row.row}`}</Text>
              <TokenBadge token={row.token} />
              <Text fontSize={9} style={{ color: c.text }} numberOfLines={1}>
                {row.text.slice(0, 80)}
              </Text>
            </Box>
          ))}
        </ScrollView>
      </Box>
    </Box>
  );
}

// ── Tab 2: Recorded Session ───────────────────────────────────────────────────

function RecordedSessionTab() {
  const c = useThemeColors();
  const st = useSemanticTerminal({
    mode: 'playback',
    playbackSrc: 'storybook/data/claude_session.rec.lua',
    classifier: 'claude_code',
    showTokens: true,
    showTimeline: true,
    playbackSpeed: 1.0,
    rows: 30,
    cols: 100,
  });

  const player = st.playerState;
  const isPlaying = player?.playing ?? false;
  const progress = player?.progress ?? 0;
  const time = player?.time ?? 0;
  const duration = player?.duration ?? 0;
  const speed = player?.speed ?? 1;
  const frame = player?.frame ?? 0;
  const totalFrames = player?.totalFrames ?? 0;

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }, []);

  const speeds = [0.25, 0.5, 1, 2, 4, 8];
  const [speedIdx, setSpeedIdx] = useState(2);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % speeds.length;
    setSpeedIdx(next);
    st.setSpeed(speeds[next]);
  }, [speedIdx, st.setSpeed]);

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Info bar */}
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: isPlaying ? C.liveGreen : C.pauseOrange,
        }} />
        <Text fontSize={12} style={{ color: c.text }}>{'Recorded session'}</Text>
        <Text fontSize={10} style={{ color: c.muted }}>{'classifier: claude_code'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} style={{ color: c.muted }}>
          {`Frame ${frame}/${totalFrames}`}
        </Text>
      </Box>

      {/* Terminal */}
      <Box style={{ flexGrow: 1, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
        <SemanticTerminal {...st.terminalProps} style={{ flexGrow: 1 }} />
      </Box>

      {/* Transport controls */}
      <Box style={{
        backgroundColor: C.timelineBg,
        borderRadius: 8,
        padding: 10,
        gap: 8,
      }}>
        {/* Progress bar */}
        <Box style={{
          height: 6, backgroundColor: '#334155', borderRadius: 3,
          overflow: 'hidden',
        }}>
          <Box style={{
            width: `${Math.round(progress * 100)}%`,
            height: '100%',
            backgroundColor: C.timelineProgress,
            borderRadius: 3,
          }} />
        </Box>

        {/* Controls row */}
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* Step back */}
          <Pressable onPress={st.stepBack}>
            <Box style={{ backgroundColor: C.speedBg, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
              <Text fontSize={10} style={{ color: c.text }}>{'|<'}</Text>
            </Box>
          </Pressable>

          {/* Play/Pause */}
          <Pressable onPress={isPlaying ? st.pause : st.play}>
            <Box style={{
              backgroundColor: C.timelineProgress, borderRadius: 4,
              paddingLeft: 14, paddingRight: 14, paddingTop: 4, paddingBottom: 4,
            }}>
              <Text fontSize={11} style={{ color: '#ffffff' }}>
                {isPlaying ? 'Pause' : 'Play'}
              </Text>
            </Box>
          </Pressable>

          {/* Step forward */}
          <Pressable onPress={st.step}>
            <Box style={{ backgroundColor: C.speedBg, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
              <Text fontSize={10} style={{ color: c.text }}>{'>|'}</Text>
            </Box>
          </Pressable>

          {/* Time display */}
          <Text fontSize={11} style={{ color: c.text }}>
            {`${formatTime(time)} / ${formatTime(duration)}`}
          </Text>

          <Box style={{ flexGrow: 1 }} />

          {/* Speed */}
          <Pressable onPress={cycleSpeed}>
            <Box style={{ backgroundColor: C.speedBg, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
              <Text fontSize={10} style={{ color: c.text }}>{`${speeds[speedIdx]}x`}</Text>
            </Box>
          </Pressable>
        </Box>
      </Box>

      {/* Token legend — claude_code vocabulary */}
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        <Text fontSize={9} style={{ color: c.muted, paddingTop: 2 }}>{'Tokens:'}</Text>
        {['user_prompt', 'assistant_text', 'thinking', 'tool', 'result', 'diff', 'error', 'permission', 'separator', 'status_bar'].map(t => (
          <TokenBadge key={t} token={t} />
        ))}
      </Box>
    </Box>
  );
}

// ── Tab 3: Classifier Comparison ──────────────────────────────────────────────

function ClassifierCompareTab() {
  const c = useThemeColors();

  const stBasic = useSemanticTerminal({
    mode: 'playback',
    playbackSrc: 'storybook/data/claude_session.rec.lua',
    classifier: 'basic',
    showTokens: true,
    showTimeline: true,
    rows: 24,
    cols: 80,
  });

  const stClaude = useSemanticTerminal({
    mode: 'playback',
    playbackSrc: 'storybook/data/claude_session.rec.lua',
    classifier: 'claude_code',
    showTokens: true,
    showTimeline: true,
    rows: 24,
    cols: 80,
  });

  // Sync playback: when one plays, both play
  const [synced, setSynced] = useState(true);

  const playBoth = useCallback(() => {
    stBasic.play();
    stClaude.play();
  }, [stBasic.play, stClaude.play]);

  const pauseBoth = useCallback(() => {
    stBasic.pause();
    stClaude.pause();
  }, [stBasic.pause, stClaude.pause]);

  const isPlaying = stBasic.playerState?.playing || stClaude.playerState?.playing;

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Header */}
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text fontSize={12} style={{ color: c.text }}>{'Same recording, different classifiers'}</Text>
        <Box style={{ flexGrow: 1 }} />

        {/* Synced play/pause */}
        <Pressable onPress={isPlaying ? pauseBoth : playBoth}>
          <Box style={{
            backgroundColor: C.timelineProgress, borderRadius: 4,
            paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4,
          }}>
            <Text fontSize={11} style={{ color: '#ffffff' }}>
              {isPlaying ? 'Pause Both' : 'Play Both'}
            </Text>
          </Box>
        </Pressable>
      </Box>

      {/* Side-by-side panes */}
      <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 8 }}>
        {/* Left: basic classifier */}
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#3b82f6' }} />
            <Text fontSize={11} style={{ color: c.text }}>{'basic'}</Text>
            <Text fontSize={9} style={{ color: c.muted }}>{'7 tokens'}</Text>
          </Box>
          <Box style={{ flexGrow: 1, backgroundColor: '#0f172a', borderRadius: 6, overflow: 'hidden' }}>
            <SemanticTerminal {...stBasic.terminalProps} style={{ flexGrow: 1 }} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {['command', 'output', 'error', 'success', 'heading', 'separator', 'progress'].map(t => (
              <TokenBadge key={t} token={t} />
            ))}
          </Box>
        </Box>

        {/* Right: claude_code classifier */}
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#a78bfa' }} />
            <Text fontSize={11} style={{ color: c.text }}>{'claude_code'}</Text>
            <Text fontSize={9} style={{ color: c.muted }}>{'25 tokens'}</Text>
          </Box>
          <Box style={{ flexGrow: 1, backgroundColor: '#0f172a', borderRadius: 6, overflow: 'hidden' }}>
            <SemanticTerminal {...stClaude.terminalProps} style={{ flexGrow: 1 }} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {['user_prompt', 'assistant_text', 'thinking', 'tool', 'result', 'diff', 'error', 'permission', 'status_bar'].map(t => (
              <TokenBadge key={t} token={t} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Tab 4: Graph Inspector ────────────────────────────────────────────────────

function GraphInspectorTab() {
  const c = useThemeColors();
  const st = useSemanticTerminal({
    mode: 'live',
    command: 'bash',
    classifier: 'basic',
    showTokens: true,
    showGraph: true,
    rows: 20,
    cols: 80,
  });

  const graph = st.graphState;
  const rows = st.classifiedRows;

  // Group rows by token type for distribution view
  const tokenCounts: Record<string, number> = {};
  for (const r of rows) {
    tokenCounts[r.token] = (tokenCounts[r.token] || 0) + 1;
  }
  const sortedTokens = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Top: terminal + graph side by side */}
      <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 8 }}>
        {/* Terminal */}
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text fontSize={11} style={{ color: c.text }}>{'Live Terminal'}</Text>
          <Box style={{ flexGrow: 1, backgroundColor: '#0f172a', borderRadius: 6, overflow: 'hidden' }}>
            <SemanticTerminal {...st.terminalProps} style={{ flexGrow: 1 }} />
          </Box>
        </Box>

        {/* Graph state panel */}
        <Box style={{ width: 280, gap: 8 }}>
          {/* State dashboard */}
          <Box style={{
            backgroundColor: C.stateBg,
            borderRadius: 6,
            padding: 10,
            gap: 6,
            borderWidth: 1,
            borderColor: c.border,
          }}>
            <Text fontSize={11} style={{ color: c.primary }}>{'Semantic Graph State'}</Text>
            <StatRow label="Nodes" value={String(graph?.nodeCount ?? 0)} c={c} />
            <StatRow label="Turns" value={String(graph?.turnCount ?? 0)} c={c} />
            <StatRow label="Mode" value={graph?.mode ?? 'idle'} c={c} />
            <StatRow label="Streaming" value={graph?.streaming ? 'yes' : 'no'} c={c} />
            <StatRow label="Classified Rows" value={String(rows.length)} c={c} />
          </Box>

          {/* Token distribution */}
          <Box style={{
            backgroundColor: C.stateBg,
            borderRadius: 6,
            padding: 10,
            gap: 4,
            borderWidth: 1,
            borderColor: c.border,
            flexGrow: 1,
          }}>
            <Text fontSize={11} style={{ color: c.primary }}>{'Token Distribution'}</Text>
            <ScrollView style={{ flexGrow: 1 }}>
              {sortedTokens.map(([token, count]) => (
                <Box key={token} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                  <Box style={{
                    width: 8, height: 8, borderRadius: 2,
                    backgroundColor: TOKEN_COLORS[token] || '#64748b',
                  }} />
                  <Text fontSize={9} style={{ color: c.text, width: 100 }}>{token}</Text>
                  <Box style={{
                    flexGrow: 1, height: 4, backgroundColor: '#1e293b',
                    borderRadius: 2, overflow: 'hidden',
                  }}>
                    <Box style={{
                      width: `${Math.min(100, (count / Math.max(rows.length, 1)) * 300)}%`,
                      height: '100%',
                      backgroundColor: TOKEN_COLORS[token] || '#64748b',
                      borderRadius: 2,
                    }} />
                  </Box>
                  <Text fontSize={9} style={{ color: c.muted, width: 24 }}>{String(count)}</Text>
                </Box>
              ))}
              {sortedTokens.length === 0 && (
                <Text fontSize={9} style={{ color: c.muted }}>{'Type commands to see classification...'}</Text>
              )}
            </ScrollView>
          </Box>
        </Box>
      </Box>

      {/* Bottom: classified rows table */}
      <Box style={{
        height: 140,
        backgroundColor: c.bgElevated,
        borderRadius: 6,
        padding: 8,
      }}>
        <Text fontSize={10} style={{ color: c.muted, marginBottom: 4 }}>
          {'Classified Rows (live)'}
        </Text>
        <ScrollView style={{ flexGrow: 1 }}>
          {rows.slice(-10).map((row, i) => (
            <Box key={i} style={{
              flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 2,
            }}>
              <Text fontSize={8} style={{ color: c.muted, width: 20 }}>{`${row.row}`}</Text>
              <TokenBadge token={row.token} />
              <Text fontSize={9} style={{ color: TOKEN_COLORS[row.token] || c.text }} numberOfLines={1}>
                {row.text.slice(0, 100)}
              </Text>
            </Box>
          ))}
        </ScrollView>
      </Box>
    </Box>
  );
}

function StatRow({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text fontSize={10} style={{ color: c.muted }}>{label}</Text>
      <Text fontSize={10} style={{ color: c.text }}>{value}</Text>
    </Box>
  );
}

// ── Main Story ────────────────────────────────────────────────────────────────

export function SemanticTerminalStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'live' | 'playback' | 'compare' | 'graph'>('live');

  const tabs = [
    { id: 'live',     label: 'Live Demo' },
    { id: 'playback', label: 'Recorded Session' },
    { id: 'compare',  label: 'Classifier Compare' },
    { id: 'graph',    label: 'Graph Inspector' },
  ] as const;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', gap: 4, padding: 10, paddingBottom: 0 }}>
        <Text fontSize={14} style={{ color: c.primary, paddingRight: 12, paddingTop: 4 }}>
          {'Semantic Terminal'}
        </Text>
        {tabs.map(t => (
          <Pill
            key={t.id}
            label={t.label}
            active={tab === t.id}
            onPress={() => setTab(t.id)}
          />
        ))}
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} style={{ color: c.muted, paddingTop: 6 }}>
          {'Classify any CLI. Share classifiers + skins.'}
        </Text>
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, padding: 10 }}>
        {tab === 'live' && <LiveDemoTab />}
        {tab === 'playback' && <RecordedSessionTab />}
        {tab === 'compare' && <ClassifierCompareTab />}
        {tab === 'graph' && <GraphInspectorTab />}
      </Box>
    </Box>
  );
}
