import { Box, Col, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ProcessEntry } from './hooks/useProcessList';

function ProcessLine(props: { entry: ProcessEntry }) {
  const cpuTone = props.entry.cpu > 40 ? COLORS.red : props.entry.cpu > 10 ? COLORS.yellow : COLORS.green;
  const memTone = props.entry.mem > 20 ? COLORS.red : COLORS.textBright;
  return (
    <Row style={{ gap: 8, alignItems: 'flex-start', paddingTop: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ width: 58, fontFamily: TOKENS.fontMono }}>{String(props.entry.pid)}</Text>
      <Text fontSize={10} color={cpuTone} style={{ width: 44, fontFamily: TOKENS.fontMono }}>{props.entry.cpu.toFixed(1)}</Text>
      <Text fontSize={10} color={memTone} style={{ width: 44, fontFamily: TOKENS.fontMono }}>{props.entry.mem.toFixed(1)}</Text>
      <Text fontSize={10} color={COLORS.textBright} style={{ flexGrow: 1, flexBasis: 0, fontFamily: TOKENS.fontMono }}>{props.entry.command}</Text>
    </Row>
  );
}

export function ProcessesRow(props: { processes: ProcessEntry[]; include: string; exclude: string }) {
  return (
    <Col style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Top Processes</Text>
          <Text fontSize={9} color={COLORS.textDim}>Filtered by include / exclude patterns and refreshed live.</Text>
        </Col>
        <Text fontSize={9} color={COLORS.textDim}>{props.processes.length} shown</Text>
      </Row>
      <Row style={{ gap: 8, paddingTop: 2, paddingBottom: 2 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ width: 58 }}>PID</Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ width: 44 }}>CPU</Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ width: 44 }}>MEM</Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ flexGrow: 1, flexBasis: 0 }}>COMMAND</Text>
      </Row>
      <ScrollView showScrollbar={true} style={{ maxHeight: 220, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
        <Col style={{ paddingLeft: 8, paddingRight: 8 }}>
          {props.processes.length === 0 ? (
            <Box style={{ padding: 10 }}>
              <Text fontSize={10} color={COLORS.textDim}>No processes matched the current filters.</Text>
            </Box>
          ) : props.processes.map((entry) => <ProcessLine key={String(entry.pid) + ':' + entry.command} entry={entry} />)}
        </Col>
      </ScrollView>
    </Col>
  );
}

export default ProcessesRow;
