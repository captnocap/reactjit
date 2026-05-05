import { useState, useEffect } from 'react';
import { Col, Row, Text, Box } from '@reactjit/runtime/primitives';
import { COLORS } from '../constants';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

function getHostInfo() {
  const h = globalThis as any;
  return {
    zigVersion: h.__zigVersion || 'unknown',
    qjsVersion: h.__qjsVersion || 'unknown',
    buildMode: h.__buildMode || 'unknown',
    target: h.__targetTriple || 'unknown',
    threadCount: h.__threadCount || 1,
    startTime: h.__startTime || 0,
  };
}

function getBridgeStats() {
  const h = globalThis as any;
  return {
    flushCount: h.__flushCount || 0,
    cmdCount: h.__cmdCount || 0,
    avgBatchSize: h.__avgBatchSize || 0,
    peakBatchSize: h.__peakBatchSize || 0,
  };
}

function getMemoryStats() {
  const h = globalThis as any;
  return {
    heapSize: h.__heapSize || 0,
    heapLimit: h.__heapLimit || 0,
    nodeCount: h.__nodeCount || 0,
    nodePoolSize: h.__nodePoolSize || 0,
  };
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 6, backgroundColor: COLORS.bg, borderRadius: 4 }}>
      <Text fontSize={10} color={COLORS.textDim}>{label}</Text>
      <Badge text={value} color={color || COLORS.blue} />
    </Row>
  );
}

export default function HostPanel() {
  const [info, setInfo] = useState(getHostInfo());
  const [bridge, setBridge] = useState(getBridgeStats());
  const [memory, setMemory] = useState(getMemoryStats());

  useEffect(() => {
    const id = setInterval(() => {
      setInfo(getHostInfo());
      setBridge(getBridgeStats());
      setMemory(getMemoryStats());
    }, 500);
    return () => clearInterval(id);
  }, []);

  const uptime = info.startTime ? ((Date.now() - info.startTime) / 1000).toFixed(1) : '?';

  return (
    <Col style={{ flexGrow: 1, padding: 12, gap: 12 }}>
      <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
        Host Runtime
      </Text>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Build Info" />
        <Col style={{ gap: 4 }}>
          <InfoRow label="Zig Version" value={info.zigVersion} color={COLORS.orange} />
          <InfoRow label="QuickJS Version" value={info.qjsVersion} color={COLORS.yellow} />
          <InfoRow label="Build Mode" value={info.buildMode} color={COLORS.green} />
          <InfoRow label="Target" value={info.target} color={COLORS.blue} />
          <InfoRow label="Threads" value={String(info.threadCount)} />
          <InfoRow label="Uptime" value={`${uptime}s`} color={COLORS.cyan} />
        </Col>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Bridge Stats" />
        <Col style={{ gap: 4 }}>
          <InfoRow label="Flush Calls" value={String(bridge.flushCount)} color={COLORS.cyan} />
          <InfoRow label="Total Commands" value={String(bridge.cmdCount)} color={COLORS.cyan} />
          <InfoRow label="Avg Batch" value={String(bridge.avgBatchSize)} color={COLORS.orange} />
          <InfoRow label="Peak Batch" value={String(bridge.peakBatchSize)} color={COLORS.red} />
        </Col>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Memory" />
        <Col style={{ gap: 4 }}>
          <InfoRow label="Heap Size" value={`${(memory.heapSize / 1024 / 1024).toFixed(1)} MB`} color={COLORS.green} />
          <InfoRow label="Heap Limit" value={`${(memory.heapLimit / 1024 / 1024).toFixed(1)} MB`} color={COLORS.yellow} />
          <InfoRow label="Active Nodes" value={String(memory.nodeCount)} color={COLORS.blue} />
          <InfoRow label="Node Pool" value={String(memory.nodePoolSize)} color={COLORS.purple} />
        </Col>
      </Box>
    </Col>
  );
}
