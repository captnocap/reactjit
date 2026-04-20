import { useState, useEffect } from 'react';
import { Col, Row, Text, Pressable, ScrollView, Box, TextInput } from '../../../runtime/primitives';
import { LogEntry } from '../types';
import { COLORS } from '../constants';
import { subscribeLogs, getLogHistory, clearLogs } from '../capture/console';
import SearchInput from '../components/SearchInput';

const LEVEL_COLORS: Record<string, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.blue,
  debug: COLORS.textDim,
  trace: COLORS.textDim,
  log: COLORS.text,
};

const LEVEL_BG: Record<string, string> = {
  error: '#f4877115',
  warn: '#dcdcaa15',
  info: '#569cd615',
  debug: 'transparent',
  trace: 'transparent',
  log: 'transparent',
};

export default function ConsolePanel({ logLevel = 'all' }: { logLevel?: 'all' | 'log' | 'warn' | 'error' }) {
  const [logs, setLogs] = useState<LogEntry[]>([...getLogHistory()]);
  const [filter, setFilter] = useState('');
  const [levels, setLevels] = useState<Record<string, boolean>>({
    log: true, warn: true, error: true, info: true, debug: false, trace: false,
  });
  const [evalText, setEvalText] = useState('');

  useEffect(() => {
    const onLog = () => setLogs([...getLogHistory()]);
    const unsub = subscribeLogs(onLog);
    return unsub;
  }, []);

  const levelOrder = ['log', 'info', 'debug', 'warn', 'error'];
  const minLevelIndex = logLevel === 'all' ? -1 : levelOrder.indexOf(logLevel);

  const filtered = logs.filter((l) => {
    if (!levels[l.level]) return false;
    if (minLevelIndex >= 0 && levelOrder.indexOf(l.level) < minLevelIndex) return false;
    if (!filter.trim()) return true;
    return l.message.toLowerCase().includes(filter.trim().toLowerCase());
  });

  const runEval = () => {
    const code = evalText.trim();
    if (!code) return;
    try {
      const result = (globalThis as any).eval(code);
      console.log('>', code);
      console.log(result);
    } catch (e: any) {
      console.error('Eval error:', e?.message || e);
    }
    setEvalText('');
  };

  const levelToggle = (lvl: string) => (
    <Pressable
      key={lvl}
      onPress={() => setLevels((p) => ({ ...p, [lvl]: !p[lvl] }))}
      style={{
        backgroundColor: levels[lvl] ? COLORS.bgSelected : 'transparent',
        borderRadius: 4,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderWidth: 1,
        borderColor: levels[lvl] ? COLORS.borderLight : 'transparent',
      }}
    >
      <Text
        fontSize={9}
        color={levels[lvl] ? COLORS.textBright : COLORS.textDim}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
      >
        {lvl}
      </Text>
    </Pressable>
  );

  return (
    <Col style={{ flexGrow: 1, gap: 0 }}>
      {/* Toolbar */}
      <Row
        style={{
          padding: 8,
          gap: 6,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgElevated,
        }}
      >
        <SearchInput value={filter} onChange={setFilter} placeholder="Filter logs…" width={240} />
        <Row style={{ gap: 4 }}>{['log', 'warn', 'error', 'info', 'debug'].map(levelToggle)}</Row>
        <Pressable
          onPress={() => { clearLogs(); setLogs([]); }}
          style={{ marginLeft: 'auto', backgroundColor: COLORS.bgHover, borderRadius: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderWidth: 1, borderColor: COLORS.border }}
        >
          <Text fontSize={9} color={COLORS.textDim}>Clear</Text>
        </Pressable>
      </Row>

      {/* Log list */}
      <ScrollView style={{ flexGrow: 1, padding: 4, gap: 1 }}>
        <Col style={{ gap: 1 }}>
          {filtered.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim} style={{ padding: 12 }}>No messages</Text>
          ) : (
            filtered.map((l) => (
              <Row
                key={l.id}
                style={{
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: 5,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderRadius: 4,
                  backgroundColor: LEVEL_BG[l.level] || 'transparent',
                }}
              >
                <Text fontSize={9} color={LEVEL_COLORS[l.level] || COLORS.textDim} style={{ minWidth: 36, fontWeight: 'bold' }}>
                  {l.level}
                </Text>
                <Text fontSize={10} color={COLORS.text} style={{ flexGrow: 1 }}>
                  {l.message}
                </Text>
                {l.count > 1 ? (
                  <Box style={{ backgroundColor: COLORS.bgElevated, borderRadius: 8, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text fontSize={9} color={COLORS.textMuted}>{l.count}</Text>
                  </Box>
                ) : null}
              </Row>
            ))
          )}
        </Col>
      </ScrollView>

      {/* Eval input */}
      <Row
        style={{
          gap: 6,
          alignItems: 'center',
          padding: 8,
          borderTopWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgElevated,
        }}
      >
        <Text fontSize={12} color={COLORS.accentLight} style={{ fontWeight: 'bold' }}>{'>'}</Text>
        <TextInput
          value={evalText}
          placeholder="eval() expression…"
          style={{
            flexGrow: 1,
            height: 28,
            backgroundColor: COLORS.bg,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingLeft: 8,
            paddingRight: 8,
            fontSize: 11,
          }}
          onSubmit={runEval}
          onChangeText={setEvalText}
        />
        <Pressable
          onPress={runEval}
          style={{
            backgroundColor: COLORS.accent,
            borderRadius: 4,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Run</Text>
        </Pressable>
      </Row>
    </Col>
  );
}
