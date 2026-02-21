import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Pressable,
  ScrollView,
  Text,
  useLoveRPC,
  useWindowDimensions,
} from '@reactjit/core';
import type { LoveEvent } from '@reactjit/core';

const MAX_SCROLLBACK_LINES = 1200;
const READ_BURST_BYTES = 65536;

type ParseMode = 'none' | 'esc' | 'csi' | 'osc' | 'oscEsc';

interface PtyStatus {
  supported: boolean;
  running: boolean;
  exited: boolean;
  pid?: number;
  shell?: string;
  cols?: number;
  rows?: number;
  exitCode?: number;
  exitSignal?: number;
  error?: string;
}

interface PtyDrainResult extends PtyStatus {
  data?: string;
  bytes?: number;
}

interface ScreenState {
  history: string[];
  liveLine: string;
}

function isCsiFinalByte(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x40 && code <= 0x7e;
}

function keyEventToBytes(event: LoveEvent): string | null {
  const key = (event.key || '').toLowerCase();
  const special: Record<string, string> = {
    return: '\r',
    enter: '\r',
    kpenter: '\r',
    tab: '\t',
    backspace: '\x7f',
    escape: '\x1b',
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
    home: '\x1b[H',
    end: '\x1b[F',
    pageup: '\x1b[5~',
    pagedown: '\x1b[6~',
    delete: '\x1b[3~',
    insert: '\x1b[2~',
  };

  if (event.ctrl) {
    if (key === 'space') return '\x00';
    if (key.length === 1) {
      const code = key.charCodeAt(0);
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(code - 96);
      }
    }
  }

  if (!event.ctrl && event.alt && !event.meta && key.length === 1) {
    return `\x1b${key}`;
  }

  if (special[key]) {
    return special[key];
  }

  return null;
}

function ActionButton({
  label,
  onPress,
  tint,
}: {
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed, hovered }) => (
        <Box style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: tint,
          backgroundColor: pressed ? '#1a2433' : hovered ? '#141d2b' : '#0e1622',
        }}>
          <Text style={{ fontSize: 12, color: tint }}>
            {label}
          </Text>
        </Box>
      )}
    </Pressable>
  );
}

export function App() {
  const { width, height } = useWindowDimensions();

  const rpcStart = useLoveRPC<PtyStatus>('pty:start');
  const rpcWrite = useLoveRPC('pty:write');
  const rpcResize = useLoveRPC<PtyStatus>('pty:resize');
  const rpcDrain = useLoveRPC<PtyDrainResult>('pty:drain');
  const rpcStop = useLoveRPC<PtyStatus>('pty:stop');

  const [ptyStatus, setPtyStatus] = useState<PtyStatus>({
    supported: true,
    running: false,
    exited: false,
  });
  const [screen, setScreen] = useState<ScreenState>({
    history: ['Booting PTY shell...'],
    liveLine: '',
  });
  const [cursorVisible, setCursorVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const parseModeRef = useRef<ParseMode>('none');
  const pollingRef = useRef(false);
  const mountedRef = useRef(false);

  const viewWidth = width > 0 ? width : 1280;
  const viewHeight = height > 0 ? height : 720;
  const cols = Math.max(60, Math.floor((viewWidth - 96) / 8.5));
  const rows = Math.max(16, Math.floor((viewHeight - 220) / 18));

  const appendChunk = useCallback((chunk: string) => {
    if (!chunk) return;

    setScreen((prev) => {
      let history = prev.history;
      let liveLine = prev.liveLine;
      let mode = parseModeRef.current;
      let cloned = false;

      const ensureClone = () => {
        if (!cloned) {
          history = history.slice();
          cloned = true;
        }
      };

      const pushLine = () => {
        ensureClone();
        history.push(liveLine);
        liveLine = '';
        if (history.length > MAX_SCROLLBACK_LINES) {
          history.splice(0, history.length - MAX_SCROLLBACK_LINES);
        }
      };

      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];

        if (mode === 'none') {
          if (ch === '\x1b') {
            mode = 'esc';
            continue;
          }
          if (ch === '\r') {
            liveLine = '';
            continue;
          }
          if (ch === '\n') {
            pushLine();
            continue;
          }
          if (ch === '\b' || ch === '\x7f') {
            if (liveLine.length > 0) {
              liveLine = liveLine.slice(0, -1);
            }
            continue;
          }
          if (ch === '\t') {
            liveLine += '    ';
            continue;
          }
          if (ch.charCodeAt(0) >= 0x20) {
            liveLine += ch;
          }
          continue;
        }

        if (mode === 'esc') {
          if (ch === '[') {
            mode = 'csi';
          } else if (ch === ']') {
            mode = 'osc';
          } else {
            mode = 'none';
          }
          continue;
        }

        if (mode === 'csi') {
          if (isCsiFinalByte(ch)) {
            mode = 'none';
          }
          continue;
        }

        if (mode === 'osc') {
          if (ch === '\x07') {
            mode = 'none';
          } else if (ch === '\x1b') {
            mode = 'oscEsc';
          }
          continue;
        }

        if (mode === 'oscEsc') {
          mode = ch === '\\' ? 'none' : 'osc';
        }
      }

      parseModeRef.current = mode;
      if (!cloned && liveLine === prev.liveLine) {
        return prev;
      }
      return { history, liveLine };
    });
  }, []);

  const clearScreen = useCallback(() => {
    parseModeRef.current = 'none';
    setScreen({ history: [], liveLine: '' });
    setStatusMessage('');
  }, []);

  const startSession = useCallback(async (nextCols: number, nextRows: number) => {
    parseModeRef.current = 'none';
    setScreen({ history: ['Launching shell...'], liveLine: '' });
    setStatusMessage('');

    try {
      const status = await rpcStart({ cols: nextCols, rows: nextRows });
      setPtyStatus(status);
    } catch (err) {
      const message = String(err);
      setStatusMessage(message);
      setPtyStatus((prev) => ({ ...prev, running: false, error: message }));
    }
  }, [rpcStart]);

  const sendBytes = useCallback((data: string) => {
    if (!data) return;
    void rpcWrite({ data }).catch((err) => {
      setStatusMessage(String(err));
    });
  }, [rpcWrite]);

  const onTextInput = useCallback((event: LoveEvent) => {
    if (!event.text) return;
    sendBytes(event.text);
  }, [sendBytes]);

  const onKeyDown = useCallback((event: LoveEvent) => {
    const bytes = keyEventToBytes(event);
    if (bytes) {
      sendBytes(bytes);
    }
  }, [sendBytes]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void startSession(cols, rows);
    return () => {
      void rpcStop().catch(() => {});
    };
  }, [cols, rows, rpcStop, startSession]);

  useEffect(() => {
    if (!ptyStatus.running) return;
    void rpcResize({ cols, rows })
      .then((status) => setPtyStatus(status))
      .catch((err) => setStatusMessage(String(err)));
  }, [cols, rows, ptyStatus.running, rpcResize]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const packet = await rpcDrain({ maxBytes: READ_BURST_BYTES });
        if (cancelled) return;

        if (packet.data) {
          appendChunk(packet.data);
        }

        setPtyStatus((prev) => ({
          ...prev,
          ...packet,
        }));
      } catch (err) {
        if (!cancelled) {
          setStatusMessage(String(err));
        }
      } finally {
        pollingRef.current = false;
      }
    };

    const timer = setInterval(() => {
      void poll();
    }, 33);

    void poll();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appendChunk, rpcDrain]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const terminalText = useMemo(() => {
    const cursor = cursorVisible && ptyStatus.running ? '_' : '';
    const tail = `${screen.liveLine}${cursor}`;
    if (screen.history.length === 0) return tail;
    return `${screen.history.join('\n')}\n${tail}`;
  }, [cursorVisible, ptyStatus.running, screen.history, screen.liveLine]);

  const stateLabel = ptyStatus.running ? 'RUNNING' : ptyStatus.exited ? 'EXITED' : 'IDLE';
  const statusColor = ptyStatus.running ? '#6ee7b7' : ptyStatus.exited ? '#fda4af' : '#93c5fd';
  const secondaryLine = statusMessage || ptyStatus.error || `${cols}x${rows} cells`;

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#050a12',
      backgroundGradient: {
        direction: 'vertical',
        colors: ['#08101d', '#04070d'],
      },
      padding: 20,
      gap: 12,
    }}>
      <Box style={{
        width: '100%',
        height: 72,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0d1726',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1f3048',
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
      }}>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 16, color: '#e2edff', fontWeight: '700' }}>
            PTY Terminal Demo
          </Text>
          <Text style={{ fontSize: 11, color: '#8aa3c9' }}>
            {'React = layout/state | LuaJIT = real PTY'}
          </Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton
            label="Restart"
            tint="#7dd3fc"
            onPress={() => { void startSession(cols, rows); }}
          />
          <ActionButton
            label="Clear"
            tint="#c4b5fd"
            onPress={clearScreen}
          />
          <ActionButton
            label="Stop"
            tint="#fca5a5"
            onPress={() => { void rpcStop().then((status) => setPtyStatus(status)); }}
          />
        </Box>
      </Box>

      <Box
        style={{
          width: '100%',
          flexGrow: 1,
          backgroundColor: '#090f1b',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#243853',
          overflow: 'hidden',
        }}
        focusable
        onKeyDown={onKeyDown}
        onTextInput={onTextInput}
      >
        <Box style={{
          width: '100%',
          height: 36,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor: '#1f3046',
          backgroundColor: '#0c1627',
        }}>
          <Text style={{ fontSize: 11, color: statusColor, fontWeight: '700' }}>
            {`${stateLabel}${ptyStatus.pid ? ` | pid ${ptyStatus.pid}` : ''}`}
          </Text>
          <Text style={{ fontSize: 11, color: '#6f86a8' }}>
            {`scrollback ${screen.history.length} lines`}
          </Text>
        </Box>

        <ScrollView style={{
          width: '100%',
          flexGrow: 1,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: '#070d18',
        }}>
          <Text style={{
            fontSize: 14,
            lineHeight: 18,
            color: '#d7e5ff',
          }}>
            {terminalText}
          </Text>
        </ScrollView>
      </Box>

      <Box style={{
        width: '100%',
        height: 38,
        backgroundColor: '#0b1523',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1c2e45',
        justifyContent: 'center',
        paddingLeft: 12,
        paddingRight: 12,
      }}>
        <Text style={{ fontSize: 11, color: '#8fa6c7' }}>
          {secondaryLine}
        </Text>
      </Box>
    </Box>
  );
}
