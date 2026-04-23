const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { DistroArt } from './DistroArt';
import { ProcessesRow } from './ProcessesRow';
import { SystemActions } from './SystemActions';
import { SystemRow } from './SystemRow';
import { buildSystemMarkdown, SYSTEM_ROWS, useSystemInfo } from './hooks/useSystemInfo';
import { useProcessList } from './hooks/useProcessList';

function Chip(props: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress}>
      <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.active ? COLORS.blue : COLORS.border, backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt }}>
        <Text fontSize={9} color={props.active ? COLORS.blue : COLORS.text}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

export function SystemInfoPanel() {
  const system = useSystemInfo();
  const processes = useProcessList({ intervalMs: system.settings.refreshIntervalMs, include: system.settings.processInclude, exclude: system.settings.processExclude, limit: 5 });
  const markdown = useMemo(() => buildSystemMarkdown(system.snapshot, system.settings.visibleRows, processes.processes), [system.snapshot, system.settings.visibleRows, processes.processes]);
  const visible = useMemo(() => new Set(system.settings.visibleRows), [system.settings.visibleRows]);

  return (
    <Col style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>System Info</Text>
          <Text fontSize={10} color={COLORS.textDim}>Live neofetch-style system summary from shell commands.</Text>
        </Col>
        <SystemActions markdown={markdown} savePath={system.settings.savePath} onSavePathChange={system.setSavePath} onRefresh={system.refresh} />
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box style={{ width: 260, minWidth: 240, borderRightWidth: 1, borderRightColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, padding: 12 }}>
          <DistroArt distro={system.snapshot.distro} />
        </Box>

        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, padding: 12 }}>
          <Col style={{ gap: 12 }}>
            <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Refresh & filters</Text>
                  <Text fontSize={9} color={COLORS.textDim}>Interval, row visibility, and process filters persist via local store.</Text>
                </Col>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {[2000, 5000, 10000, 30000].map((ms) => <Chip key={String(ms)} label={String(ms / 1000) + 's'} active={system.settings.refreshIntervalMs === ms} onPress={() => system.setRefreshIntervalMs(ms)} />)}
                </Row>
              </Row>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {SYSTEM_ROWS.map((row) => <Chip key={row.key} label={row.label} active={visible.has(row.key)} onPress={() => system.toggleRow(row.key)} />)}
              </Row>
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                <TextInput value={system.settings.processInclude} onChangeText={system.setProcessInclude} placeholder="include processes (comma-separated)" style={{ flexGrow: 1, flexBasis: 0, minWidth: 220, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10 }} />
                <TextInput value={system.settings.processExclude} onChangeText={system.setProcessExclude} placeholder="exclude processes (comma-separated)" style={{ flexGrow: 1, flexBasis: 0, minWidth: 220, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10 }} />
              </Row>
            </Box>

            <Box style={{ gap: 0, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              {SYSTEM_ROWS.filter((row) => visible.has(row.key)).map((row) => (
                <SystemRow key={row.key} label={row.label} value={system.snapshot.values[row.key]} />
              ))}
            </Box>

            <ProcessesRow processes={processes.processes} include={system.settings.processInclude} exclude={system.settings.processExclude} />
          </Col>
        </ScrollView>
      </Row>
    </Col>
  );
}

export default SystemInfoPanel;
