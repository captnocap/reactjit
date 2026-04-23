
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, fileTone, samePath } from '../theme';
import { Icon } from './icons';
import { HoverPressable, Pill } from './shared';
import { Tooltip } from './tooltip';
import { VirtualFileTree } from './filetree';



function gitGutterColor(gitStatus: string): string | null {
  if (!gitStatus) return null;
  const code = gitStatus.trim();
  if (code.startsWith('A') || code.startsWith('M') || code.startsWith('D') || code.startsWith('R')) return COLORS.green;
  if (code === '??' || code.startsWith('?')) return COLORS.blue;
  if (code.includes('M') || code.includes('D')) return COLORS.yellow;
  if (code.includes('R') || code.includes('C')) return COLORS.purple;
  return COLORS.textMuted;
}

function DockButton(props: {
  active?: boolean;
  count?: string;
  icon: string;
  label: string;
  tone: string;
  onPress: () => void;
  tooltip?: string;
}) {
  const active = props.active === true;
  return (
    <Tooltip label={props.tooltip || props.label} side="right">
      <HoverPressable
        onPress={props.onPress}
        style={{
          paddingTop: 7,
          paddingBottom: 7,
          paddingLeft: 7,
          paddingRight: 7,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? props.tone : COLORS.border,
          backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Icon name={props.icon} size={18} color={active ? props.tone : COLORS.textMuted} />
        {props.count ? <Text fontSize={8} color={props.tone}>{props.count}</Text> : null}
      </HoverPressable>
    </Tooltip>
  );
}

function PanelShell(props: {
  title: string;
  icon: string;
  tone: string;
  subtitle?: string;
  count?: string;
  active?: boolean;
  onClose?: () => void;
  children: any;
}) {
  const active = props.active === true;
  return (
    <Box
      style={{
        position: 'relative',
        borderWidth: 1,
        borderColor: active ? props.tone : COLORS.border,
        borderRadius: 14,
        backgroundColor: active ? COLORS.panelRaised : COLORS.panelBg,
        overflow: 'hidden',
      }}
    >
      <Row
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          alignSelf: 'stretch',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 9,
          paddingBottom: 9,
          backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Icon name={props.icon} size={14} color={props.tone} />
        <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
            {props.count ? <Pill label={props.count} color={props.tone} tiny={true} /> : null}
          </Row>
          {props.subtitle ? <Text fontSize={9} color={COLORS.textDim}>{props.subtitle}</Text> : null}
        </Col>
        {props.onClose ? (
          <Tooltip label={`Close ${props.title.toLowerCase()} panel`} side="left">
            <Pressable onPress={props.onClose} style={{ padding: 4, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Icon name="x" size={14} color={COLORS.textMuted} />
            </Pressable>
          </Tooltip>
        ) : null}
      </Row>
      <Col
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          alignSelf: 'stretch',
          marginTop: -1,
          paddingTop: 13,
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 12,
          gap: 10,
          backgroundColor: active ? COLORS.panelRaised : COLORS.panelBg,
        }}
      >
        {props.children}
      </Col>
    </Box>
  );
}

function FilesPanel(props: any) {
  const openEditorLimit = props.compactBand ? 8 : 6;
  const fileLimit = props.compactBand ? 28 : 40;
  const openEditors = props.tabs.filter((tab: any) => tab.path !== '__landing__');

  return (
    <PanelShell
      title="Files"
      icon="folder"
      tone={COLORS.blue}
      subtitle={props.workspaceName}
      count={String(openEditors.length) + ' open'}
      active={props.active === 'files'}
      onClose={props.onClose}
    >
      <Tooltip label="Open landing view" side="right">
        <Pressable
          onPress={props.onOpenHome}
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
            gap: 6,
          }}
        >
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Icon name="folder" size={14} color={COLORS.blue} />
            <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.workspaceName}</Text>
          </Row>
          <Row style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Icon name="git-branch" size={12} color={COLORS.green} />
              <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
            </Row>
            <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
            <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} />
          </Row>
          {props.widthBand === 'desktop' ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
        </Pressable>
      </Tooltip>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Tooltip label="Refresh workspace tree" side="bottom" shortcut="Ctrl+Shift+R">
          <HoverPressable onPress={props.onRefreshWorkspace} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.blue}>Refresh</Text>
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Create a new file" side="bottom" shortcut="Ctrl+N">
          <HoverPressable onPress={props.onCreateFile} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.green}>New File</Text>
          </HoverPressable>
        </Tooltip>
      </Row>

      <Box style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>OPEN EDITORS</Text>
        {openEditors.slice(0, openEditorLimit).map((tab: any) => (
          <Pressable
            key={tab.id}
            onPress={() => props.onSelectPath(tab.path)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 10,
              backgroundColor: samePath(tab.path, props.currentFilePath) ? COLORS.panelHover : COLORS.panelRaised,
            }}
          >
            <Icon name={tab.type === 'dir' ? 'folder' : 'file'} size={14} color={fileTone(tab.type)} />
            <Text fontSize={11} color={COLORS.text}>{tab.name}</Text>
            {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
            <Box style={{ flexGrow: 1 }} />
            {tab.git ? <Pill label={tab.git} color={COLORS.textMuted} tiny={true} /> : null}
          </Pressable>
        ))}
      </Box>

      <Box style={{ minHeight: 0 }}>
        <VirtualFileTree
          files={props.files}
          currentFilePath={props.currentFilePath}
          onSelectPath={props.onSelectPath}
          minHeight={160}
          maxHeight={560}
        />
      </Box>
    </PanelShell>
  );
}

function SourceControlPanel(props: any) {
  const changes = props.gitChanges.slice(0, props.compactBand ? 10 : 16);
  return (
    <PanelShell
      title="Source Control"
      icon="git-branch"
      tone={COLORS.green}
      subtitle={props.gitBranch}
      count={String(props.changedCount) + ' dirty'}
      active={props.active === 'source-control'}
      onClose={props.onClose}
    >
      <Box
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelRaised,
          gap: 6,
        }}
      >
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
          <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} />
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>Remote {props.gitRemote} • {props.workDir}</Text>
      </Box>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Tooltip label="Refresh workspace tree" side="bottom" shortcut="Ctrl+Shift+R">
          <Pressable onPress={props.onRefreshWorkspace} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.blue}>Refresh</Text>
          </Pressable>
        </Tooltip>
      </Row>

      <Box style={{ gap: 6 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>CHANGES</Text>
        {changes.map((item: any) => (
          <Pressable
            key={item.path}
            onPress={() => props.onSelectPath(item.path)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 10,
              backgroundColor: COLORS.panelRaised,
            }}
          >
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tone }} />
            <Text fontSize={10} color={COLORS.textBright}>{item.status}</Text>
            <Text fontSize={10} color={COLORS.textDim}>{item.path}</Text>
          </Pressable>
        ))}
      </Box>
    </PanelShell>
  );
}

function SidebarImpl(props: any) {
  const _rT0 = Date.now();
  (globalThis as any).__hostLog?.(0, "[render] Sidebar start t=" + _rT0);
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  const openEditorLimit = compactBand ? 8 : mediumBand ? 4 : 6;
  const changeLimit = compactBand ? 8 : mediumBand ? 4 : 6;

  if (!props.multiPanel || compactBand) {
    return (
      <Col
        style={{
          width: props.style?.width || 280,
          height: '100%',
          backgroundColor: COLORS.panelBg,
          borderRightWidth: 1,
          borderColor: COLORS.border,
          ...props.style,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
          <Text fontSize={11} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            {compactBand ? 'FILES' : 'WORKSPACE'}
          </Text>
          <Row style={{ gap: 8 }}>
            <Tooltip label="Refresh workspace tree" side="bottom" shortcut="Ctrl+Shift+R"><Pressable onPress={props.onRefreshWorkspace}><Text fontSize={10} color={COLORS.blue}>RF</Text></Pressable></Tooltip>
            <Tooltip label="Create a new file" side="bottom" shortcut="Ctrl+N"><Pressable onPress={props.onCreateFile}><Text fontSize={10} color={COLORS.blue}>+</Text></Pressable></Tooltip>
          </Row>
        </Row>

        <Pressable
          onPress={props.onOpenHome}
          style={{
            marginLeft: 12,
            marginRight: 12,
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
          }}
        >
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.workspaceName}</Text>
          <Row style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
            <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
            {!mediumBand ? <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} /> : null}
          </Row>
          {props.widthBand === 'desktop' ? <Text fontSize={10} color={COLORS.textDim} style={{ marginTop: 8 }}>{props.workDir}</Text> : null}
        </Pressable>

        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>OPEN EDITORS</Text>
        </Box>
        <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
          {props.tabs.slice(0, openEditorLimit).map((tab: any) => {
            if (tab.path === '__landing__') return null;
            return (
              <Pressable
                key={tab.id}
                onPress={() => props.onSelectPath(tab.path)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: samePath(tab.path, props.currentFilePath) ? COLORS.panelHover : COLORS.panelRaised,
                }}
              >
                <Icon name={tab.type === 'dir' ? 'folder' : 'file'} size={14} color={fileTone(tab.type)} />
                <Text fontSize={11} color={COLORS.text}>{tab.name}</Text>
                {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
                <Box style={{ flexGrow: 1 }} />
                {tab.git ? <Pill label={tab.git} color={COLORS.textMuted} tiny={true} /> : null}
              </Pressable>
            );
          })}
        </Box>

        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            SOURCE CONTROL
          </Text>
        </Box>
        <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
          {props.gitChanges.slice(0, changeLimit).map((item: any) => (
            <Pressable
              key={item.path}
              onPress={() => props.onSelectPath(item.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 10,
                backgroundColor: COLORS.panelRaised,
              }}
            >
              <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tone }} />
              <Text fontSize={10} color={COLORS.textBright}>{item.status}</Text>
              <Text fontSize={10} color={COLORS.textDim}>{item.path}</Text>
            </Pressable>
          ))}
        </Box>

        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            EXPLORER
          </Text>
        </Box>
        <VirtualFileTree
          files={props.files}
          currentFilePath={props.currentFilePath}
          onSelectPath={props.onSelectPath}
          minHeight={140}
          maxHeight={400}
        />
      </Col>
    );
  }

  const defaultDockPanels = useMemo(() => {
    const defaults = (props.panelDefs || [])
      .filter((panel: any) => panel.defaultSlot === 'left' && panel.defaultOpen)
      .map((panel: any) => panel.id);
    if (defaults.length > 0) return defaults;
    return (props.panelDefs || [])
      .filter((panel: any) => panel.defaultSlot === 'left')
      .slice(0, 1)
      .map((panel: any) => panel.id);
  }, [props.panelDefs]);
  const panelOrder = (props.dockPanels || defaultDockPanels).filter((panelId: string, idx: number, list: string[]) => panelId && list.indexOf(panelId) === idx);
  const leftRailPanels = useMemo(() => {
    return (props.panelDefs || []).filter((panel: any) => panel.defaultSlot === 'left' && panel.userVisible !== false);
  }, [props.panelDefs]);
  const openEditorCount = props.tabs.filter((tab: any) => tab.path !== '__landing__').length;
  const changeCount = props.gitChanges.length;

  return (
    <Row
      style={{
        width: props.style?.width || 328,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: COLORS.panelBg,
        borderRightWidth: 1,
        borderColor: COLORS.border,
        ...props.style,
      }}
    >
      <Col
        style={{
          width: 56,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 8,
          paddingRight: 8,
          gap: 8,
          backgroundColor: COLORS.panelBg,
          borderRightWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        {leftRailPanels.map((panel: any) => (
          <DockButton
            key={panel.id}
            active={panelOrder[0] === panel.id}
            count={panel.id === 'files' ? String(openEditorCount) : panel.id === 'source-control' ? String(changeCount) : undefined}
            icon={panel.icon}
            label={panel.title}
            tone={panel.id === 'files' ? COLORS.blue : panel.id === 'source-control' ? COLORS.green : COLORS.textMuted}
            tooltip={'Show ' + panel.title.toLowerCase()}
            onPress={() => props.onFocusDockPanel(panel.id)}
          />
        ))}
        <Box style={{ flexGrow: 1 }} />
        <DockButton
          active={false}
          icon="refresh"
          label="Refresh"
          tone={COLORS.blue}
          tooltip="Refresh workspace tree"
          onPress={props.onRefreshWorkspace}
        />
        <DockButton
          active={false}
          icon="plus"
          label="New"
          tone={COLORS.green}
          tooltip="Create a new file"
          onPress={props.onCreateFile}
        />
      </Col>

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0 }}>
        <Col style={{ padding: 10, gap: 10 }}>
          {panelOrder.map((panelId: string) => {
            if (panelId === 'files') {
              return (
                <FilesPanel
                  key="files"
                  active={panelOrder[0] === 'files' ? 'files' : ''}
                  compactBand={compactBand}
                  currentFilePath={props.currentFilePath}
                  files={props.files}
                  gitBranch={props.gitBranch}
                  changedCount={props.changedCount}
                  stagedCount={props.stagedCount}
                  onClose={() => props.onCloseDockPanel('files')}
                  onCreateFile={props.onCreateFile}
                  onOpenHome={props.onOpenHome}
                  onRefreshWorkspace={props.onRefreshWorkspace}
                  onSelectPath={props.onSelectPath}
                  tabs={props.tabs}
                  widthBand={props.widthBand}
                  workspaceName={props.workspaceName}
                  workDir={props.workDir}
                />
              );
            }
            if (panelId === 'source-control') {
              return (
                <SourceControlPanel
                  key="source-control"
                  active={panelOrder[0] === 'source-control' ? 'source-control' : ''}
                  compactBand={compactBand}
                  changedCount={props.changedCount}
                  gitBranch={props.gitBranch}
                  gitChanges={props.gitChanges}
                  gitRemote={props.gitRemote}
                  onClose={() => props.onCloseDockPanel('source-control')}
                  onRefreshWorkspace={props.onRefreshWorkspace}
                  onSelectPath={props.onSelectPath}
                  stagedCount={props.stagedCount}
                  workDir={props.workDir}
                />
              );
            }
            return null;
          })}
        </Col>
      </ScrollView>
    </Row>
  );
}

export const Sidebar = memo(SidebarImpl);
