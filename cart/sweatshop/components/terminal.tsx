const React: any = require('react');
const { useCallback, useEffect, useRef, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Terminal, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { HoverPressable, Pill } from './shared';
import { Icon } from './icons';
import { useHover } from '../anim';
import { useTerminalDockDrag } from '../hooks/useTerminalDockDrag';

const host: any = globalThis as any;
const CTRL_MOD = 192;
const SHIFT_MOD = 1;
const TAB_KEY = 9;
const KEY_L = 76;
const KEY_F = 70;
const KEY_C = 67;
const DEFAULT_SCROLLBACK_LIMIT = 2000;
const SCROLLBACK_LIMIT_KEY = 'cursor-ide.terminalScrollbackLimit';

type TerminalSession = {
  id: string;
  name: string;
  ptyHandle: number;
};

type TerminalTranscript = {
  pending: string;
  lines: string[];
};

type SearchSelection = {
  sessionId: string;
  lineIndex: number;
} | null;

function toHandle(value: any, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const maybe = value.ptyHandle ?? value.handle ?? value.id;
    if (typeof maybe === 'number' && Number.isFinite(maybe)) return maybe;
  }
  return fallback;
}

function spawnPty(cols: number, rows: number, fallback: number): number {
  try {
    if (typeof host.__pty_open !== 'function') return fallback;
    return toHandle(host.__pty_open(cols, rows), fallback);
  } catch {
    return fallback;
  }
}

function ptyAlive(handle: number): boolean {
  try {
    return typeof host.__pty_alive === 'function' ? !!host.__pty_alive(handle) : true;
  } catch {
    return false;
  }
}

function ptyRead(handle: number): string {
  try {
    if (typeof host.__pty_read !== 'function') return '';
    const out = host.__pty_read(handle);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

function ptyWrite(handle: number, data: string): void {
  try {
    if (typeof host.__pty_write === 'function') host.__pty_write(handle, data);
  } catch {}
}

function clipboardSet(text: string): void {
  try {
    if (typeof host.__clipboard_set === 'function') host.__clipboard_set(text);
  } catch {}
}

function storeGet(key: string): string | null {
  try {
    if (typeof host.__store_get !== 'function') return null;
    const out = host.__store_get(key);
    return out == null ? null : String(out);
  } catch {
    return null;
  }
}

function storeSet(key: string, value: string): void {
  try {
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch {}
}

function clampScrollback(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCROLLBACK_LIMIT;
  return Math.max(100, Math.min(20000, Math.floor(value)));
}

function loadScrollbackLimit(): number {
  return clampScrollback(Number(storeGet(SCROLLBACK_LIMIT_KEY) ?? DEFAULT_SCROLLBACK_LIMIT));
}

function stripAnsi(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\u001b\][^\u001b]*\u0007/g, '')
    .replace(/\u001b[PX^_][^\u001b]*\u001b\\/g, '')
    .replace(/\u001b./g, '');
}

function splitTranscriptChunk(chunk: string): string[] {
  const normalized = stripAnsi(chunk);
  return normalized.split('\n').map((line) => line.replace(/\t/g, '    '));
}

function highlightLineParts(line: string, query: string): Array<{ text: string; highlight: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text: line, highlight: false }];
  const lowered = line.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  while (cursor < line.length) {
    const index = lowered.indexOf(needle, cursor);
    if (index < 0) {
      parts.push({ text: line.slice(cursor), highlight: false });
      break;
    }
    if (index > cursor) parts.push({ text: line.slice(cursor, index), highlight: false });
    parts.push({ text: line.slice(index, index + needle.length), highlight: true });
    cursor = index + needle.length;
  }
  return parts.length > 0 ? parts : [{ text: line, highlight: false }];
}

function ToolbarIconButton(props: {
  icon: string;
  tooltip: string;
  onPress?: () => void;
  active?: boolean;
  tone?: string;
}) {
  const [hoverHandlers, hovered] = useHover();
  const active = !!props.active;
  const tone = props.tone || (active ? COLORS.blue : COLORS.textDim);
  return (
    <Box style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        {...hoverHandlers}
        onPress={props.onPress}
        style={{
          width: 28,
          height: 28,
          borderRadius: TOKENS.radiusMd,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hovered || active ? COLORS.panelAlt : 'transparent',
          borderWidth: 1,
          borderColor: hovered || active ? COLORS.border : 'transparent',
        }}
      >
        <Icon name={props.icon as any} size={14} color={tone} />
      </Pressable>
      {hovered ? (
        <Box
          style={{
            position: 'absolute',
            top: 30,
            right: 0,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: TOKENS.radiusSm,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
            zIndex: 50,
          }}
        >
          <Text fontSize={9} color={COLORS.textBright}>{props.tooltip}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function TerminalPanel(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const history = props.history || [];
  const playState = props.playState || null;
  const isRecording = !!props.recording;
  const recordFrames = props.recordFrames || 0;
  const activePane = props.pane || 'live';

  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [scrollbackLimit, setScrollbackLimit] = useState(() => loadScrollbackLimit());
  const [selectedSearchLine, setSelectedSearchLine] = useState<SearchSelection>(null);
  const dockDrag = useTerminalDockDrag({
    minHeight: compactBand ? 180 : 220,
    maxHeight: 1600,
  });

  const sessionsRef = useRef<TerminalSession[]>([]);
  const transcriptRef = useRef<Record<string, TerminalTranscript>>({});
  const activeSessionIdRef = useRef('');
  const nextSessionOrdinalRef = useRef(1);
  const bootstrappedRef = useRef(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState('');

  const sessions = sessionsRef.current;
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || null;
  const activeTranscript = activeSession ? transcriptRef.current[activeSession.id] || { pending: '', lines: [] } : { pending: '', lines: [] };

  useEffect(() => {
    storeSet(SCROLLBACK_LIMIT_KEY, String(scrollbackLimit));
  }, [scrollbackLimit]);

  const bumpSessions = useCallback(() => {
    setSessionRevision((value) => value + 1);
  }, []);

  const setActiveSession = useCallback((id: string) => {
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    setSelectedSearchLine(null);
  }, []);

  const clampTranscript = useCallback((entry: TerminalTranscript) => {
    const limit = scrollbackLimit;
    if (entry.lines.length > limit) {
      entry.lines.splice(0, entry.lines.length - limit);
    }
  }, [scrollbackLimit]);

  const ensureSession = useCallback((focus: boolean = false) => {
    const ordinal = nextSessionOrdinalRef.current++;
    const ptyHandle = spawnPty(120, compactBand ? 26 : 30, ordinal - 1);
    const session: TerminalSession = {
      id: 'term_' + ordinal + '_' + Date.now().toString(36),
      name: ordinal === 1 ? 'shell' : 'shell ' + ordinal,
      ptyHandle,
    };
    sessionsRef.current = [...sessionsRef.current, session];
    transcriptRef.current[session.id] = transcriptRef.current[session.id] || { pending: '', lines: [] };
    if (focus || !activeSessionIdRef.current) {
      setActiveSession(session.id);
    }
    bumpSessions();
    return session;
  }, [bumpSessions, compactBand, setActiveSession]);

  const closeSession = useCallback((sessionId: string) => {
    const current = sessionsRef.current;
    const remaining = current.filter((session) => session.id !== sessionId);
    delete transcriptRef.current[sessionId];
    sessionsRef.current = remaining;

    if (remaining.length === 0) {
      sessionsRef.current = [];
      activeSessionIdRef.current = '';
      setActiveSessionId('');
      setSelectedSearchLine(null);
      ensureSession(true);
      return;
    }

    const activeIdx = current.findIndex((session) => session.id === activeSessionIdRef.current);
    const nextActive = activeIdx >= 0
      ? remaining[Math.min(activeIdx, remaining.length - 1)]
      : remaining[remaining.length - 1];

    setActiveSession(nextActive.id);
    bumpSessions();
  }, [bumpSessions, ensureSession, setActiveSession]);

  const focusSession = useCallback((sessionId: string) => {
    if (activeSessionIdRef.current === sessionId) return;
    if (!sessionsRef.current.some((session) => session.id === sessionId)) return;
    setActiveSession(sessionId);
    if (props.onSetPane) props.onSetPane('live');
  }, [setActiveSession, props]);

  const cycleSession = useCallback(() => {
    const list = sessionsRef.current;
    if (list.length <= 1) return;
    const currentIndex = Math.max(0, list.findIndex((session) => session.id === activeSessionIdRef.current));
    const next = list[(currentIndex + 1) % list.length];
    setActiveSession(next.id);
    if (props.onSetPane) props.onSetPane('live');
  }, [setActiveSession, props]);

  const clearCurrentTerminal = useCallback(() => {
    if (!activeSession) return;
    ptyWrite(activeSession.ptyHandle, '\x1b[H\x1b[2J\x1b[3J');
  }, [activeSession]);

  const copySelectedLine = useCallback(() => {
    if (!selectedSearchLine) return;
    const session = sessionsRef.current.find((item) => item.id === selectedSearchLine.sessionId);
    if (!session) return;
    const line = (transcriptRef.current[session.id]?.lines[selectedSearchLine.lineIndex]) || '';
    if (line) clipboardSet(line);
  }, [selectedSearchLine]);

  const openSearch = useCallback(() => {
    setFindOpen(true);
    if (props.onSetPane) props.onSetPane('live');
  }, [props]);

  const handleTerminalKeyDown = useCallback((payload: any) => {
    const keyCode = Number(payload?.keyCode ?? payload?.key ?? 0);
    const mods = Number(payload?.mods ?? 0);
    const ctrl = (mods & CTRL_MOD) !== 0;
    const shift = (mods & SHIFT_MOD) !== 0;

    if (ctrl && keyCode === TAB_KEY) {
      cycleSession();
      return;
    }
    if (ctrl && keyCode === KEY_L) {
      clearCurrentTerminal();
      return;
    }
    if (ctrl && shift && keyCode === KEY_F) {
      openSearch();
      return;
    }
    if (ctrl && keyCode === KEY_C && selectedSearchLine) {
      copySelectedLine();
    }
  }, [clearCurrentTerminal, copySelectedLine, cycleSession, openSearch, selectedSearchLine]);

  const appendTranscript = useCallback((sessionId: string, chunk: string) => {
    if (!chunk) return;
    const entry = transcriptRef.current[sessionId] || (transcriptRef.current[sessionId] = { pending: '', lines: [] });
    const pieces = splitTranscriptChunk(chunk);
    if (pieces.length === 0) return;

    let pending = entry.pending + pieces[0];
    const complete: string[] = [];
    const normalizedChunk = stripAnsi(chunk).replace(/\r/g, '\n');

    if (normalizedChunk.includes('\n')) {
      const split = normalizedChunk.split('\n');
      split[0] = pending;
      pending = split.pop() || '';
      for (const line of split) {
        complete.push(line.replace(/\t/g, '    '));
      }
      if (complete.length === 0 && pending.length > 0) {
        entry.pending = pending;
        return;
      }
    } else if (pieces.length === 1) {
      entry.pending = pending;
      return;
    }

    if (!normalizedChunk.includes('\n') && pieces.length > 1) {
      for (let i = 1; i < pieces.length - 1; i += 1) complete.push(pieces[i]);
      pending = pieces[pieces.length - 1];
    }

    if (complete.length > 0) {
      entry.lines.push(...complete);
      clampTranscript(entry);
    }
    entry.pending = pending;
    if (pending.length > 0 && entry.lines.length > 0) {
      const last = entry.lines[entry.lines.length - 1];
      if (last !== pending && !pending.endsWith('\n')) {
        // keep partial line in pending only
      }
    }
  }, [clampTranscript]);

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      if (sessionsRef.current.length === 0) {
        ensureSession(true);
      } else if (!activeSessionIdRef.current) {
        setActiveSession(sessionsRef.current[0].id);
      }
    }
  }, [ensureSession, sessionRevision, setActiveSession]);

  useEffect(() => {
    const id = setInterval(() => {
      for (const session of sessionsRef.current) {
        if (!ptyAlive(session.ptyHandle)) continue;
        const chunk = ptyRead(session.ptyHandle);
        if (chunk) appendTranscript(session.id, chunk);
      }
    }, 80);
    return () => clearInterval(id);
  }, [appendTranscript]);

  useEffect(() => {
    if (!activeSession) return;
    setSelectedSearchLine(null);
  }, [activeSessionId]);

  function SessionTab(session: TerminalSession) {
    const active = session.id === activeSessionId;
    return (
      <Row
        key={session.id}
        style={{
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 8,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: TOKENS.radiusLg,
          borderWidth: 1,
          borderColor: active ? COLORS.blue : COLORS.border,
          backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <HoverPressable onPress={() => focusSession(session.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pill label={session.name} color={active ? COLORS.blue : COLORS.textBright} tiny={true} />
          <Text fontSize={9} color={COLORS.textDim}>{'pty ' + String(session.ptyHandle)}</Text>
        </HoverPressable>
        <HoverPressable onPress={() => closeSession(session.id)} style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
          <Text fontSize={10} color={COLORS.textDim}>x</Text>
        </HoverPressable>
      </Row>
    );
  }

  function HistoryEntryRow(entry: any) {
    return (
      <Box
        key={entry.id}
        style={{
          padding: 10,
          borderRadius: TOKENS.radiusLg,
          backgroundColor: COLORS.panelAlt,
          borderWidth: 1,
          borderColor: COLORS.borderSoft,
          gap: 4,
        }}
      >
        <Row style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
            <Pill label={entry.kind} color={COLORS.blue} tiny={true} />
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{entry.title}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>
            {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Row>
        <Text fontSize={10} color={COLORS.text}>{entry.detail}</Text>
        {entry.path ? <Text fontSize={9} color={COLORS.textDim}>{entry.path}</Text> : null}
      </Box>
    );
  }

  function PlaybackSummary() {
    if (!playState) {
      return <Text fontSize={10} color={COLORS.textDim}>No playback loaded.</Text>;
    }
    return (
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pill label={playState.playing ? 'playing' : 'paused'} color={playState.playing ? COLORS.green : COLORS.textDim} tiny={true} />
        <Text fontSize={10} color={COLORS.textDim}>{Math.round((playState.progress || 0) * 100) + '%'}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{'f' + playState.frame + '/' + playState.total_frames}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{String(playState.speed || 1) + 'x'}</Text>
      </Row>
    );
  }

  function SearchResultRow(session: TerminalSession, line: string, lineIndex: number, matchesQuery: boolean) {
    const selected = selectedSearchLine?.sessionId === session.id && selectedSearchLine.lineIndex === lineIndex;
    return (
      <HoverPressable
        key={session.id + '_' + lineIndex}
        onPress={() => {
          const nextSelection = { sessionId: session.id, lineIndex };
          setSelectedSearchLine(nextSelection);
          if (line) clipboardSet(line);
        }}
        style={{
          padding: 8,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1,
          borderColor: selected ? COLORS.blue : matchesQuery ? COLORS.border : COLORS.borderSoft,
          backgroundColor: selected ? COLORS.blueDeep : matchesQuery ? COLORS.panelAlt : COLORS.panelRaised,
          gap: 4,
        }}
      >
        <Row style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
            <Pill label={session.name} color={selected ? COLORS.blue : COLORS.textBright} tiny={true} />
            <Text fontSize={9} color={COLORS.textDim}>{'line ' + String(lineIndex + 1)}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>{matchesQuery ? 'match' : 'buffer'}</Text>
        </Row>
        <Text fontSize={10} color={selected ? COLORS.textBright : COLORS.text}>
          {highlightLineParts(line, findQuery).map((part, idx) => (
            <Text
              key={idx}
              fontSize={10}
              color={part.highlight ? COLORS.blue : selected ? COLORS.textBright : COLORS.text}
              style={part.highlight ? { backgroundColor: COLORS.blueDeep } : undefined}
            >
              {part.text}
            </Text>
          ))}
        </Text>
      </HoverPressable>
    );
  }

  const activeLines = activeTranscript.lines;
  const searchLines = findQuery.trim()
    ? activeLines
        .map((line, index) => ({ line, index }))
        .filter((item) => item.line.toLowerCase().includes(findQuery.trim().toLowerCase()))
    : activeLines.map((line, index) => ({ line, index }));

  const searchMatches = searchLines.length;
  return (
    <Col
      style={{
        backgroundColor: COLORS.panelBg,
        borderTopWidth: 1,
        borderColor: COLORS.borderSoft,
        height: props.height || '100%',
        minHeight: 0,
        flexGrow: props.expanded ? 1 : 0,
        marginTop: props.expanded ? 0 : 'auto',
      }}
    >
      {!compactBand && !props.expanded ? (
        <Pressable
          onMouseDown={() => dockDrag.begin(typeof props.height === 'number' ? props.height : 250)}
          style={{
            height: 6,
            backgroundColor: COLORS.panelAlt,
            borderBottomWidth: 1,
            borderColor: COLORS.borderSoft,
            cursor: 'ns-resize',
          }}
        >
          <Box
            style={{
              alignSelf: 'center',
              width: 44,
              height: 2,
              marginTop: 2,
              borderRadius: TOKENS.radiusPill,
              backgroundColor: dockDrag.dragging ? COLORS.blue : COLORS.border,
            }}
          />
        </Pressable>
      ) : null}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 8 : 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 8 }}>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          {sessions.map((session) => SessionTab(session))}
          <HoverPressable
            onPress={() => {
              ensureSession(true);
              if (props.onSetPane) props.onSetPane('live');
            }}
            style={{
              width: 28,
              height: 28,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: TOKENS.radiusMd,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelAlt,
            }}
          >
            <Icon name="plus" size={13} color={COLORS.textBright} />
          </HoverPressable>
        </Row>
        {props.onClose ? (
          <ToolbarIconButton icon="x" tooltip="Close terminal" onPress={props.onClose} />
        ) : null}
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg, position: 'relative' }}>
          <Box style={{ display: activePane === 'live' ? 'flex' : 'none', width: '100%', height: '100%', minHeight: 0 }}>
            {sessions.length > 0 ? sessions.map((session) => (
              <Box
                key={session.id}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  display: session.id === activeSessionId ? 'flex' : 'none',
                }}
              >
                <Terminal
                  terminal_id={session.ptyHandle}
                  style={{ width: '100%', height: '100%' }}
                  fontSize={compactBand ? 12 : 13}
                  onKeyDown={session.id === activeSessionId ? handleTerminalKeyDown : undefined}
                />
              </Box>
            )) : (
              <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Text fontSize={11} color={COLORS.textDim}>No terminal sessions yet.</Text>
                <HoverPressable
                  onPress={() => ensureSession(true)}
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 7,
                    paddingBottom: 7,
                    borderRadius: TOKENS.radiusLg,
                    backgroundColor: COLORS.panelAlt,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Text fontSize={10} color={COLORS.textBright}>Spawn shell</Text>
                </HoverPressable>
              </Col>
            )}
          </Box>

          {activePane === 'history' ? (
            <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, minHeight: 0 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Session history</Text>
              <Text fontSize={10} color={COLORS.textDim}>
                {history.length > 0 ? 'Recent terminal events and saved snapshots live in localstore.' : 'No saved terminal history yet.'}
              </Text>
              <ScrollView style={{ flexGrow: 1, minHeight: 0 }}>
                <Col style={{ gap: 8 }}>
                  {history.length > 0 ? history.map((entry: any) => HistoryEntryRow(entry)) : null}
                </Col>
              </ScrollView>
            </Col>
          ) : null}

          {activePane === 'recorder' ? (
            <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, minHeight: 0 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recorder</Text>
                <PlaybackSummary />
              </Row>
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                <HoverPressable onPress={props.onToggleRecording} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: isRecording ? COLORS.redDeep : COLORS.panelAlt, borderWidth: 1, borderColor: isRecording ? COLORS.red : COLORS.border }}>
                  <Text fontSize={10} color={isRecording ? COLORS.red : COLORS.textBright}>{isRecording ? 'Stop recording' : 'Start recording'}</Text>
                </HoverPressable>
                <HoverPressable onPress={props.onSaveSnapshot} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text fontSize={10} color={COLORS.textBright}>Save snapshot</Text>
                </HoverPressable>
                <HoverPressable onPress={props.onLoadPlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text fontSize={10} color={COLORS.textBright}>Load playback</Text>
                </HoverPressable>
                <HoverPressable onPress={props.onTogglePlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text fontSize={10} color={COLORS.textBright}>Play / pause</Text>
                </HoverPressable>
                <HoverPressable onPress={props.onStepPlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text fontSize={10} color={COLORS.textBright}>Step</Text>
                </HoverPressable>
              </Row>
              <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, gap: 4 }}>
                <Text fontSize={10} color={COLORS.textDim}>Recording stays local to the current terminal session. Saving snapshots adds an entry to the history tab.</Text>
                {playState ? <Text fontSize={10} color={COLORS.textDim}>{'Playback ' + Math.round((playState.progress || 0) * 100) + '%'}</Text> : null}
              </Box>
            </Col>
          ) : null}

          {activePane === 'live' && findOpen ? (
            <Col style={{ position: 'absolute', left: 8, right: 8, top: 8, bottom: 8, minHeight: 0, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, zIndex: 20 }}>
              <Row style={{ padding: 10, alignItems: 'center', gap: 8, justifyContent: 'space-between', borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
                <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Find in buffer</Text>
                  <TextInput
                    value={findQuery}
                    onChange={(value: string) => {
                      setFindQuery(value);
                      setSelectedSearchLine(null);
                    }}
                    fontSize={11}
                    color={COLORS.text}
                    style={{ minWidth: 220, flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, padding: 8, borderRadius: TOKENS.radiusMd }}
                  />
                  <Pill label={String(searchMatches) + ' matches'} color={COLORS.blue} tiny={true} />
                </Row>
                <Row style={{ gap: 8, alignItems: 'center' }}>
                  <Text fontSize={10} color={COLORS.textDim}>Scrollback</Text>
                  <HoverPressable onPress={() => setScrollbackLimit((value) => clampScrollback(value - 250))}>
                    <Text fontSize={11} color={COLORS.textBright}>-</Text>
                  </HoverPressable>
                  <Text fontSize={10} color={COLORS.textBright}>{String(scrollbackLimit)}</Text>
                  <HoverPressable onPress={() => setScrollbackLimit((value) => clampScrollback(value + 250))}>
                    <Text fontSize={11} color={COLORS.textBright}>+</Text>
                  </HoverPressable>
                  <HoverPressable onPress={() => setFindOpen(false)}>
                    <Text fontSize={10} color={COLORS.textDim}>Close</Text>
                  </HoverPressable>
                </Row>
              </Row>
              <ScrollView style={{ flexGrow: 1, minHeight: 0 }}>
                <Col style={{ gap: 8, padding: 10 }}>
                  {searchLines.length > 0 ? searchLines.map((item) => {
                    return SearchResultRow(activeSession || sessions[0], item.line, item.index, true);
                  }) : (
                    <Text fontSize={10} color={COLORS.textDim}>No matches yet. Open a session and keep typing.</Text>
                  )}
                </Col>
              </ScrollView>
            </Col>
          ) : null}
        </Box>

        <Box style={{ width: compactBand ? 32 : 36, borderLeftWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8 }}>
          <ToolbarIconButton icon="terminal" tooltip="Live terminal" onPress={() => { if (props.onJumpLive) props.onJumpLive(); props.onSetPane?.('live'); }} active={activePane === 'live'} />
          <ToolbarIconButton icon="clock" tooltip="History" onPress={() => { props.onSetPane?.('history'); }} active={activePane === 'history'} />
          <ToolbarIconButton icon={isRecording ? 'pause' : 'play'} tooltip="Recorder" onPress={() => { props.onSetPane?.('recorder'); }} active={activePane === 'recorder'} />
          <ToolbarIconButton icon="search" tooltip={findOpen ? 'Close find' : 'Find in buffer'} onPress={() => setFindOpen((value) => !value)} active={findOpen} />
          {!compactBand && !props.expanded && props.onToggleExpanded ? (
            <ToolbarIconButton icon="panel-bottom" tooltip={props.expanded ? 'Restore dock' : 'Take over'} onPress={props.onToggleExpanded} active={!!props.expanded} />
          ) : null}
          <ToolbarIconButton icon="refresh" tooltip="Clear terminal" onPress={clearCurrentTerminal} />
          {activePane === 'history' && props.onClearHistory ? (
            <ToolbarIconButton icon="trash" tooltip="Clear history" onPress={props.onClearHistory} />
          ) : null}
          {activePane === 'recorder' ? (
            <ToolbarIconButton icon="save" tooltip="Save snapshot" onPress={props.onSaveSnapshot} />
          ) : null}
        </Box>
      </Row>
    </Col>
  );
}
