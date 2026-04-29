import { useState, useEffect } from 'react';
import { Col, Row, Text, Pressable, ScrollView, Box } from '@reactjit/runtime/primitives';
import { NetworkEntry } from '../types';
import { COLORS } from '../constants';
import { subscribeNetwork, getNetworkHistory, clearNetwork, getNetworkStats } from '../capture/network';
import { formatTime, formatBytes, safeString } from '../utils';
import SearchInput from '../components/SearchInput';
import Badge from '../components/Badge';
import SectionHeader from '../components/SectionHeader';

const OP_COLORS: Record<string, string> = {
  CREATE: COLORS.green,
  UPDATE: COLORS.blue,
  DELETE: COLORS.red,
  APPEND: COLORS.yellow,
  TEXT: COLORS.cyan,
};

export default function NetworkPanel() {
  const [entries, setEntries] = useState<NetworkEntry[]>([...getNetworkHistory()]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number>(0);
  const [stats, setStats] = useState(getNetworkStats());

  useEffect(() => {
    const onNet = () => {
      setEntries([...getNetworkHistory()]);
      setStats(getNetworkStats());
    };
    const unsub = subscribeNetwork(onNet);
    return unsub;
  }, []);

  const filtered = entries.filter((e) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return e.cmds.some((c) => JSON.stringify(c).toLowerCase().includes(q));
  });

  const selected = selectedId ? entries.find((e) => e.id === selectedId) || null : null;

  // Waterfall: find max duration for scaling
  const maxDuration = Math.max(1, ...filtered.map((e) => e.durationUs || 1));

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
        <SearchInput value={filter} onChange={setFilter} placeholder="Filter commands…" width={240} />
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Badge text={`${stats.total} batches`} />
          <Badge text={formatBytes(stats.totalSize)} color={COLORS.green} />
          {Object.entries(stats.ops).slice(0, 4).map(([op, count]) => (
            <Badge key={op} text={`${op}: ${count}`} color={OP_COLORS[op] || COLORS.cyan} />
          ))}
        </Row>
        <Pressable
          onPress={() => { clearNetwork(); setEntries([]); setStats(getNetworkStats()); setSelectedId(0); }}
          style={{ marginLeft: 'auto', backgroundColor: COLORS.bgHover, borderRadius: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderWidth: 1, borderColor: COLORS.border }}
        >
          <Text fontSize={9} color={COLORS.textDim}>Clear</Text>
        </Pressable>
      </Row>

      <Row style={{ flexGrow: 1, gap: 0 }}>
        {/* List */}
        <Col style={{ width: 300, borderRightWidth: 1, borderColor: COLORS.border }}>
          <ScrollView style={{ flexGrow: 1, padding: 4, gap: 2 }}>
            <Col style={{ gap: 2 }}>
              {filtered.map((e) => {
                const barWidth = Math.max(2, ((e.durationUs || 1) / maxDuration) * 80);
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setSelectedId(e.id)}
                    style={{
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor: selectedId === e.id ? COLORS.bgSelected : 'transparent',
                      gap: 4,
                      borderLeftWidth: selectedId === e.id ? 3 : 0,
                      borderColor: COLORS.accentLight,
                    }}
                  >
                    <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text fontSize={9} color={COLORS.textBright}>{`#${e.id}`}</Text>
                      <Text fontSize={9} color={COLORS.textDim}>{formatTime(e.timestamp)}</Text>
                    </Row>
                    <Row style={{ gap: 4, alignItems: 'center' }}>
                      <Badge text={`${e.count} cmd${e.count > 1 ? 's' : ''}`} />
                      {e.durationUs ? <Badge text={`${e.durationUs}µs`} color={COLORS.green} /> : null}
                    </Row>
                    {/* Waterfall bar */}
                    <Row style={{ height: 4, backgroundColor: COLORS.bg, borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                      <Box style={{ width: barWidth, backgroundColor: COLORS.accentLight, borderRadius: 2 }} />
                    </Row>
                  </Pressable>
                );
              })}
            </Col>
          </ScrollView>
        </Col>

        {/* Detail */}
        <Col style={{ flexGrow: 1, padding: 10, gap: 6 }}>
          {selected ? (
            <Col style={{ gap: 6 }}>
              <SectionHeader title={`Entry #${selected.id}`} />
              <Text fontSize={10} color={COLORS.textDim}>
                {`Time: ${formatTime(selected.timestamp)} · Duration: ${selected.durationUs || '?'}µs · Commands: ${selected.count} · Size: ${formatBytes(selected.sizeEstimate || 0)}`}
              </Text>
              <ScrollView style={{ flexGrow: 1, gap: 4 }}>
                <Col style={{ gap: 4 }}>
                  {selected.cmds.map((cmd, idx) => (
                    <Box
                      key={idx}
                      style={{
                        backgroundColor: COLORS.bg,
                        borderRadius: 6,
                        padding: 8,
                        gap: 4,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                      }}
                    >
                      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Row style={{ gap: 6, alignItems: 'center' }}>
                          <Badge text={cmd.op || '?'} color={OP_COLORS[cmd.op] || COLORS.textDim} />
                          {cmd.id ? <Text fontSize={9} color={COLORS.textDim}>#{cmd.id}</Text> : null}
                        </Row>
                        <Pressable
                          onPress={() => {
                            const text = safeString(cmd, 10000);
                            if ((globalThis as any).__copyToClipboard) {
                              (globalThis as any).__copyToClipboard(text);
                            } else {
                              console.log('[copy cmd]', text);
                            }
                          }}
                          style={{
                            backgroundColor: COLORS.bgElevated,
                            borderRadius: 4,
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 2,
                            paddingBottom: 2,
                          }}
                        >
                          <Text fontSize={8} color={COLORS.textDim}>copy</Text>
                        </Pressable>
                      </Row>
                      <Text fontSize={9} color={COLORS.text}>{safeString(cmd, 400)}</Text>
                    </Box>
                  ))}
                </Col>
              </ScrollView>
            </Col>
          ) : (
            <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text fontSize={12} color={COLORS.textDim}>Select an entry to inspect commands.</Text>
              <Text fontSize={10} color={COLORS.textDim}>{`${stats.total} total batches captured`}</Text>
            </Col>
          )}
        </Col>
      </Row>
    </Col>
  );
}
