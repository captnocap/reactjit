const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useMultiWindow } from '../window-mgmt/useMultiWindow';
import { TabStrip } from './TabStrip';
import { TerminalInstance } from './TerminalInstance';
import { useTerminalTabs } from './useTerminalTabs';

export function TerminalTabs(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const initialCwd = typeof props.workDir === 'string' && props.workDir ? props.workDir : '.';
  const tabs = useTerminalTabs(initialCwd);
  const windows = useMultiWindow();
  const [renameTabId, setRenameTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeTab = tabs.activeTab;
  if (activeTab) {
    try {
      const h = globalThis as any;
      if (typeof h.__terminal_set_cwd === 'function') h.__terminal_set_cwd(activeTab.cwd || initialCwd);
    } catch (_e) {}
  }

  useEffect(() => {
    const target: any = typeof window !== 'undefined' ? window : globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;
    const onKeyDown = (event: any) => {
      if (!activeTab) return;
      if (!event.ctrlKey || event.metaKey) return;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === 't') {
        event.preventDefault?.();
        event.stopPropagation?.();
        tabs.createTab(activeTab.cwd || initialCwd);
        return;
      }
      if (key === 'w') {
        event.preventDefault?.();
        event.stopPropagation?.();
        tabs.closeTab(activeTab.id);
        return;
      }
      if (key === 'tab') {
        event.preventDefault?.();
        event.stopPropagation?.();
        tabs.cycleTab();
      }
    };
    target.addEventListener('keydown', onKeyDown, true);
    return () => {
      try { target.removeEventListener('keydown', onKeyDown, true); } catch {}
    };
  }, [activeTab, initialCwd, tabs]);

  const startRename = (tabId: string) => {
    const tab = tabs.tabs.find((item) => item.id === tabId);
    setRenameTabId(tabId);
    setRenameValue(tab?.customLabel || tab?.label || '');
  };

  const closeOthers = (tabId: string) => {
    for (const tab of [...tabs.tabs]) {
      if (tab.id !== tabId) tabs.closeTab(tab.id);
    }
  };

  const moveToWindow = (tabId: string) => {
    const tab = tabs.tabs.find((item) => item.id === tabId);
    if (!tab) return;
    windows.openPanel('terminal', { title: tab.label, width: 960, height: 700 });
    tabs.closeTab(tabId);
  };

  return (
    <Col style={{ backgroundColor: COLORS.panelBg, borderTopWidth: 1, borderColor: COLORS.borderSoft, height: props.height || '100%', minHeight: 0, flexGrow: props.expanded ? 1 : 0, marginTop: props.expanded ? 0 : 'auto' }}>
      <TabStrip
        tabs={tabs.tabs}
        activeIndex={tabs.activeIndex}
        labelFormat={tabs.settings.labelFormat}
        maxTabs={tabs.settings.maxTabs}
        onActivate={tabs.setActive}
        onCreateTab={() => tabs.createTab(activeTab?.cwd || initialCwd)}
        onCloseTab={tabs.closeTab}
        onCloseOthers={closeOthers}
        onDuplicateTab={tabs.duplicateTab}
        onRenameTab={startRename}
        onMoveTab={tabs.moveTab}
        onMoveToNewWindow={moveToWindow}
        onSetLabelFormat={tabs.setLabelFormat}
      />

      {renameTabId ? (
        <Box style={{ position: 'absolute', left: 14, top: 52, zIndex: 500, width: 280, padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>RENAME TAB</Text>
          <TextInput value={renameValue} onChange={(value: string) => setRenameValue(value)} fontSize={11} color={COLORS.text} style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelAlt }} />
          <Row style={{ gap: 8 }}>
            <Pressable onPress={() => { tabs.renameTab(renameTabId, renameValue.trim()); setRenameTabId(null); }} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={10} color={COLORS.blue}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setRenameTabId(null)} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={10} color={COLORS.textDim}>Cancel</Text>
            </Pressable>
          </Row>
        </Box>
      ) : null}

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, position: 'relative', display: 'flex' }}>
        {activeTab ? (
          <TerminalInstance
            key={activeTab.id}
            tab={activeTab}
            widthBand={props.widthBand}
            height={props.height}
            pane={props.pane}
            history={props.history}
            recording={props.recording}
            recordFrames={props.recordFrames}
            playState={props.playState}
            expanded={props.expanded}
            onSetPane={props.onSetPane}
            onToggleExpanded={props.onToggleExpanded}
            onBeginResize={props.onBeginResize}
            onToggleRecording={props.onToggleRecording}
            onSaveSnapshot={props.onSaveSnapshot}
            onLoadPlayback={props.onLoadPlayback}
            onTogglePlayback={props.onTogglePlayback}
            onStepPlayback={props.onStepPlayback}
            onJumpLive={props.onJumpLive}
            onClearHistory={props.onClearHistory}
            onCloseTab={tabs.closeTab}
            onRequestNewTab={() => tabs.createTab(activeTab.cwd)}
            onCycleTabs={tabs.cycleTab}
            onMarkDirty={tabs.setDirty}
            onCwdChange={(tabId: string, cwd: string) => tabs.updateTab(tabId, { cwd })}
            onExitTab={tabs.settings.closeOnExit ? tabs.closeTab : undefined}
          />
        ) : null}
      </Box>

      {props.onClose ? (
        <Row style={{ justifyContent: 'flex-end', padding: 8, borderTopWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright}>Close terminal</Text>
          </Pressable>
        </Row>
      ) : null}
    </Col>
  );
}
