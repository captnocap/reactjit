import { useState, useEffect } from 'react';
import { Col, Row, Text, Box, Graph } from '@reactjit/runtime/primitives';
import { COLORS } from '../constants';
import SectionHeader from '../components/SectionHeader';

function getHeapSize(): number {
  const h = globalThis as any;
  if (h.__getHeapSize && typeof h.__getHeapSize === 'function') {
    try { return h.__getHeapSize(); } catch { return 0; }
  }
  return 0;
}

export default function MemoryPanel() {
  const [history, setHistory] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const heap = getHeapSize();
      setCurrent(heap);
      setHistory((prev) => {
        const next = [...prev, heap];
        if (next.length > 120) next.shift();
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...history);
  const points = history.length < 2
    ? ''
    : `M ${history.map((v, i) => `${i * 4},${70 - (v / max) * 70}`).join(' L ')}`;

  return (
    <Col style={{ flexGrow: 1, padding: 12, gap: 12 }}>
      <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Memory</Text>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 4, minWidth: 120, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Heap Size</Text>
          <Text fontSize={18} color={COLORS.green} style={{ fontWeight: 'bold' }}>
            {current > 0 ? `${(current / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
          </Text>
        </Box>
        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 4, minWidth: 120, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Peak</Text>
          <Text fontSize={18} color={COLORS.orange} style={{ fontWeight: 'bold' }}>
            {max > 0 ? `${(max / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
          </Text>
        </Box>
        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 4, minWidth: 120, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Samples</Text>
          <Text fontSize={18} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{history.length}</Text>
        </Box>
      </Row>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Heap Size Over Time" />
        <Box style={{ height: 80, backgroundColor: COLORS.bg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}>
          <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
            <Graph.Path d={points} stroke={COLORS.green} strokeWidth={1.5} />
          </Graph>
        </Box>
      </Box>
    </Col>
  );
}
