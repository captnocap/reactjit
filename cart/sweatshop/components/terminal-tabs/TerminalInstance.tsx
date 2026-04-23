
import { Box, Col, Pressable, Row, ScrollView, Terminal, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { Icon } from '../icons';
import { useHover } from '../../anim';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import { useTerminalSpawn } from './useTerminalSpawn';
import type { TerminalTabRecord } from './useTerminalTabs';

const CTRL_MOD = 192;
const SHIFT_MOD = 1;
const TAB_KEY = 9;
const KEY_L = 76;
const KEY_F = 70;
const KEY_C = 67;
const KEY_T = 84;
const KEY_W = 87;
const DEFAULT_SCROLLBACK_LIMIT = 2000;

type TerminalTranscript = { pending: string; lines: string[] };
type SearchSelection = number | null;

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
  return stripAnsi(chunk).split('\n').map((line) => line.replace(/\t/g, '    '));
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

function ToolbarIconButton(props: { icon: string; tooltip: string; onPress?: () => void; active?: boolean; tone?: string }) {
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
        <Box style={{ position: 'absolute', top: 30, right: 0, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, zIndex: 50 }}>
          <Text fontSize={9} color={COLORS.textBright}>{props.tooltip}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function TerminalInstance(props: {
  tab: TerminalTabRecord & { label: string; active: boolean; index: number };
  widthBand: string;
  height?: number | string;
  pane?: string;
  history?: any[];
  recording?: number;
  recordFrames?: number;
  playState?: any;
  expanded?: number;
  onSetPane?: (pane: string) => void;
  onToggleExpanded?: () => void;
  onBeginResize?: any;
  onToggleRecording?: () => void;
  onSaveSnapshot?: () => void;
  onLoadPlayback?: () => void;
  onTogglePlayback?: () => void;
  onStepPlayback?: () => void;
  onJumpLive?: () => void;
  onClearHistory?: () => void;
  onCloseTab?: (tabId: string) => void;
  onRequestNewTab?: () => void;
  onCycleTabs?: () => void;
  onMarkDirty?: (tabId: string, dirty: boolean) => void;
  onCwdChange?: (tabId: string, cwd: string) => void;
  onExitTab?: (tabId: string) => void;
}) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const history = props.history || [];
  const playState = props.playState || null;
  const isRecording = !!props.recording;
  const recordFrames = props.recordFrames || 0;
  const activePane = props.pane || 'live';
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [scrollbackLimit, setScrollbackLimit] = useState(DEFAULT_SCROLLBACK_LIMIT);
  const [selectedSearchLine, setSelectedSearchLine] = useState<SearchSelection>(null);
  const [revision, setRevision] = useState(0);
  const historyScrollRef = useRef(null);
  const historyScroll = useDragToScroll(historyScrollRef, { axis: 'y', inertia: false, grabCursor: true, surfaceKey: 'scrolling.terminalDragToScroll' });
  const findScrollRef = useRef(null);
  const findScroll = useDragToScroll(findScrollRef, { axis: 'y', inertia: false, grabCursor: true, surfaceKey: 'scrolling.terminalDragToScroll' });
  const transcriptRef = useRef<TerminalTranscript>({ pending: '', lines: [] });

  const appendTranscript = useCallback((chunk: string) => {
    if (!chunk) return;
    const entry = transcriptRef.current;
    const pieces = splitTranscriptChunk(chunk);
    if (pieces.length === 0) return;

    let pending = entry.pending + pieces[0];
    const complete: string[] = [];
    const normalizedChunk = stripAnsi(chunk).replace(/\r/g, '\n');

    if (normalizedChunk.includes('\n')) {
      const split = normalizedChunk.split('\n');
      split[0] = pending;
      pending = split.pop() || '';
      for (const line of split) complete.push(line.replace(/\t/g, '    '));
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
      if (entry.lines.length > scrollbackLimit) {
        entry.lines.splice(0, entry.lines.length - scrollbackLimit);
      }
    }
    entry.pending = pending;
    setRevision((value) => value + 1);
  }, [scrollbackLimit]);

  const terminal = useTerminalSpawn({
    tabId: props.tab.id,
    cwd: props.tab.cwd,
    cols: 120,
    rows: compactBand ? 26 : 30,
    focused: props.tab.active,
    onOutput: (chunk: string) => {
      appendTranscript(chunk);
      props.onMarkDirty?.(props.tab.id, !props.tab.active);
    },
    onCwdChange: (cwd: string) => {
      if (!cwd || cwd === props.tab.cwd) return;
      props.onCwdChange?.(props.tab.id, cwd);
    },
    onExit: () => {
      props.onMarkDirty?.(props.tab.id, false);
      if (props.onExitTab) props.onExitTab(props.tab.id);
    },
  });

  useEffect(() => {
    if (props.tab.active) {
      props.onMarkDirty?.(props.tab.id, false);
      setSelectedSearchLine(null);
    }
  }, [props.tab.active, props.tab.id]);

  const clearCurrentTerminal = useCallback(() => {
    terminal.write('\x1b[H\x1b[2J\x1b[3J');
  }, [terminal]);

  const copySelectedLine = useCallback(() => {
    if (selectedSearchLine == null) return;
    const line = transcriptRef.current.lines[selectedSearchLine] || '';
    if (line && typeof (globalThis as any).__clipboard_set === 'function') {
      try { (globalThis as any).__clipboard_set(line); } catch {}
    }
  }, [selectedSearchLine]);

  const openSearch = useCallback(() => {
    setFindOpen(true);
    props.onSetPane?.('live');
  }, [props]);

  const handleTerminalKeyDown = useCallback((payload: any) => {
    const keyCode = Number(payload?.keyCode ?? payload?.key ?? 0);
    const mods = Number(payload?.mods ?? 0);
    const ctrl = (mods & CTRL_MOD) !== 0;
    const shift = (mods & SHIFT_MOD) !== 0;

    if (ctrl && keyCode === TAB_KEY) { props.onCycleTabs?.(); return; }
    if (ctrl && keyCode === KEY_T) { props.onRequestNewTab?.(); return; }
    if (ctrl && keyCode === KEY_W) { props.onCloseTab?.(props.tab.id); return; }
    if (ctrl && keyCode === KEY_L) { clearCurrentTerminal(); return; }
    if (ctrl && shift && keyCode === KEY_F) { openSearch(); return; }
    if (ctrl && keyCode === KEY_C && selectedSearchLine != null) { copySelectedLine(); }
  }, [clearCurrentTerminal, copySelectedLine, openSearch, props, selectedSearchLine]);

  const activeLines = transcriptRef.current.lines;
  const searchLines = findQuery.trim()
    ? activeLines.map((line, index) => ({ line, index })).filter((item) => item.line.toLowerCase().includes(findQuery.trim().toLowerCase()))
    : activeLines.map((line, index) => ({ line, index }));
  const searchMatches = searchLines.length;

  function HistoryEntryRow(entry: any) {
    return (
      <Box key={entry.id} style={{ padding: 10, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.borderSoft, gap: 4 }}>
        <Row style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
            <Pill label={entry.kind} color={COLORS.blue} tiny={true} />
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{entry.title}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </Row>
        <Text fontSize={10} color={COLORS.text}>{entry.detail}</Text>
        {entry.path ? <Text fontSize={9} color={COLORS.textDim}>{entry.path}</Text> : null}
      </Box>
    );
  }

  function SearchResultRow(line: string, lineIndex: number, matchesQuery: boolean) {
    const selected = selectedSearchLine === lineIndex;
    return (
      <HoverPressable
        key={lineIndex}
        onPress={() => {
          setSelectedSearchLine(lineIndex);
          if (line && typeof (globalThis as any).__clipboard_set === 'function') {
            try { (globalThis as any).__clipboard_set(line); } catch {}
          }
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
            <Pill label={props.tab.label} color={selected ? COLORS.blue : COLORS.textBright} tiny={true} />
            <Text fontSize={9} color={COLORS.textDim}>{'line ' + String(lineIndex + 1)}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>{matchesQuery ? 'match' : 'buffer'}</Text>
        </Row>
        <Text fontSize={10} color={selected ? COLORS.textBright : COLORS.text}>
          {highlightLineParts(line, findQuery).map((part, idx) => (
            <Text key={idx} fontSize={10} color={part.highlight ? COLORS.blue : selected ? COLORS.textBright : COLORS.text} style={part.highlight ? { backgroundColor: COLORS.blueDeep } : undefined}>
              {part.text}
            </Text>
          ))}
        </Text>
      </HoverPressable>
    );
  }

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
        display: props.tab.active ? 'flex' : 'none',
      }}
    >
      {!compactBand && !props.expanded ? (
        <Pressable
          onMouseDown={props.onBeginResize}
          style={{ height: 6, backgroundColor: COLORS.panelAlt, borderBottomWidth: 1, borderColor: COLORS.borderSoft, cursor: 'ns-resize' }}
        >
          <Box style={{ alignSelf: 'center', width: 44, height: 2, marginTop: 2, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.border }} />
        </Pressable>
      ) : null}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 8 : 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 8 }}>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Pill label={props.tab.label} color={COLORS.blue} tiny={true} />
          <Pill label={props.tab.cwd} color={COLORS.textDim} tiny={true} />
          <Pill label={terminal.alive ? 'alive' : 'closed'} color={terminal.alive ? COLORS.green : COLORS.red} tiny={true} />
          <HoverPressable onPress={props.onRequestNewTab} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }} hoverScale={1.05}>
            <Icon name="plus" size={13} color={COLORS.textBright} />
          </HoverPressable>
        </Row>
        {props.onCloseTab ? (
          <ToolbarIconButton icon="x" tooltip="Close tab" onPress={() => props.onCloseTab?.(props.tab.id)} />
        ) : null}
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg, position: 'relative' }}>
          <Box style={{ display: activePane === 'live' ? 'flex' : 'none', width: '100%', height: '100%', minHeight: 0 }}>
            {terminal.handle >= 0 ? (
              <Terminal terminal_id={terminal.handle} style={{ width: '100%', height: '100%' }} fontSize={compactBand ? 12 : 13} onKeyDown={props.tab.active ? handleTerminalKeyDown : undefined} />
            ) : (
              <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Text fontSize={11} color={COLORS.textDim}>Terminal failed to start.</Text>
                <HoverPressable onPress={terminal.restart} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text fontSize={10} color={COLORS.textBright}>Restart shell</Text>
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
              <ScrollView ref={historyScrollRef} showScrollbar={true} onScroll={historyScroll.onScroll} onMouseDown={historyScroll.onMouseDown} onMouseUp={historyScroll.onMouseUp} scrollY={historyScroll.scrollY} style={{ flexGrow: 1, minHeight: 0, cursor: historyScroll.cursor }}>
                <Col style={{ gap: 8 }}>{history.length > 0 ? history.map((entry: any) => HistoryEntryRow(entry)) : null}</Col>
              </ScrollView>
            </Col>
          ) : null}

          {activePane === 'recorder' ? (
            <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, minHeight: 0 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recorder</Text>
                <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pill label={playState?.playing ? 'playing' : 'paused'} color={playState?.playing ? COLORS.green : COLORS.textDim} tiny={true} />
                  <Text fontSize={10} color={COLORS.textDim}>{Math.round((playState?.progress || 0) * 100) + '%'}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{'f' + (playState?.frame || 0) + '/' + (playState?.total_frames || 0)}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{String(playState?.speed || 1) + 'x'}</Text>
                </Row>
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
                <Text fontSize={9} color={COLORS.textDim}>Frames: {String(recordFrames)}</Text>
              </Box>
            </Col>
          ) : null}

          {activePane === 'live' && findOpen ? (
            <Col style={{ position: 'absolute', left: 8, right: 8, top: 8, bottom: 8, minHeight: 0, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, zIndex: 20 }}>
              <Row style={{ padding: 10, alignItems: 'center', gap: 8, justifyContent: 'space-between', borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
                <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Find in buffer</Text>
                  <TextInput value={findQuery} onChange={(value: string) => { setFindQuery(value); setSelectedSearchLine(null); }} fontSize={11} color={COLORS.text} style={{ minWidth: 220, flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, padding: 8, borderRadius: TOKENS.radiusMd }} />
                  <Pill label={String(searchMatches) + ' matches'} color={COLORS.blue} tiny={true} />
                </Row>
                <Row style={{ gap: 8, alignItems: 'center' }}>
                  <Text fontSize={10} color={COLORS.textDim}>Scrollback</Text>
                  <HoverPressable onPress={() => setScrollbackLimit((value) => Math.max(100, value - 250))}><Text fontSize={11} color={COLORS.textBright}>-</Text></HoverPressable>
                  <Text fontSize={10} color={COLORS.textBright}>{String(scrollbackLimit)}</Text>
                  <HoverPressable onPress={() => setScrollbackLimit((value) => Math.min(20000, value + 250))}><Text fontSize={11} color={COLORS.textBright}>+</Text></HoverPressable>
                  <HoverPressable onPress={() => setFindOpen(false)}><Text fontSize={10} color={COLORS.textDim}>Close</Text></HoverPressable>
                </Row>
              </Row>
              <ScrollView ref={findScrollRef} showScrollbar={true} onScroll={findScroll.onScroll} onMouseDown={findScroll.onMouseDown} onMouseUp={findScroll.onMouseUp} scrollY={findScroll.scrollY} style={{ flexGrow: 1, minHeight: 0, cursor: findScroll.cursor }}>
                <Col style={{ gap: 8, padding: 10 }}>
                  {searchLines.length > 0 ? searchLines.map((item) => SearchResultRow(item.line, item.index, true)) : <Text fontSize={10} color={COLORS.textDim}>No matches yet. Open a session and keep typing.</Text>}
                </Col>
              </ScrollView>
            </Col>
          ) : null}
        </Box>

        <Box style={{ width: compactBand ? 32 : 36, borderLeftWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8 }}>
          <ToolbarIconButton icon="terminal" tooltip="Live terminal" onPress={() => { props.onJumpLive?.(); props.onSetPane?.('live'); }} active={activePane === 'live'} />
          <ToolbarIconButton icon="clock" tooltip="History" onPress={() => { props.onSetPane?.('history'); }} active={activePane === 'history'} />
          <ToolbarIconButton icon={isRecording ? 'pause' : 'play'} tooltip="Recorder" onPress={() => { props.onSetPane?.('recorder'); }} active={activePane === 'recorder'} />
          <ToolbarIconButton icon="search" tooltip={findOpen ? 'Close find' : 'Find in buffer'} onPress={() => setFindOpen((value) => !value)} active={findOpen} />
          {!compactBand && !props.expanded && props.onToggleExpanded ? <ToolbarIconButton icon="panel-bottom" tooltip={props.expanded ? 'Restore dock' : 'Take over'} onPress={props.onToggleExpanded} active={!!props.expanded} /> : null}
          <ToolbarIconButton icon="refresh" tooltip="Clear terminal" onPress={clearCurrentTerminal} />
          {activePane === 'history' && props.onClearHistory ? <ToolbarIconButton icon="trash" tooltip="Clear history" onPress={props.onClearHistory} /> : null}
          {activePane === 'recorder' ? <ToolbarIconButton icon="save" tooltip="Save snapshot" onPress={props.onSaveSnapshot} /> : null}
        </Box>
      </Row>
    </Col>
  );
}
