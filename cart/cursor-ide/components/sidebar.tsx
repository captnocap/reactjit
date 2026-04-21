const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, fileGlyph, fileTone, samePath } from '../theme';
import { Glyph, Pill } from './shared';

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
}) {
  const active = props.active === true;
  return (
    <Pressable
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
      <Glyph icon={props.icon} tone={active ? props.tone : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      <Text fontSize={8} color={active ? props.tone : COLORS.textMuted} style={{ fontWeight: 'bold' }}>
        {props.label.slice(0, 2).toUpperCase()}
      </Text>
      {props.count ? <Text fontSize={8} color={props.tone}>{props.count}</Text> : null}
    </Pressable>
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
        borderWidth: 1,
        borderColor: active ? props.tone : COLORS.border,
        borderRadius: 14,
        backgroundColor: active ? COLORS.panelRaised : COLORS.panelBg,
        overflow: 'hidden',
      }}
    >
      <Row
        style={{
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
        <Glyph icon={props.icon} tone={props.tone} backgroundColor="transparent" tiny={true} />
        <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
            {props.count ? <Pill label={props.count} color={props.tone} tiny={true} /> : null}
          </Row>
          {props.subtitle ? <Text fontSize={9} color={COLORS.textDim}>{props.subtitle}</Text> : null}
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ padding: 4, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Glyph icon="close" tone={COLORS.textMuted} backgroundColor="transparent" tiny={true} />
          </Pressable>
        ) : null}
      </Row>
      <Col style={{ padding: 12, gap: 10 }}>
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
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.workspaceName}</Text>
        <Row style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
          <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} />
        </Row>
        {props.widthBand === 'desktop' ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
      </Pressable>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={props.onRefreshWorkspace} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.blue}>Refresh</Text>
        </Pressable>
        <Pressable onPress={props.onCreateFile} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.green}>New File</Text>
        </Pressable>
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
            <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
            <Text fontSize={11} color={COLORS.text}>{tab.name}</Text>
            {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
            <Box style={{ flexGrow: 1 }} />
            {tab.git ? <Pill label={tab.git} color={COLORS.textMuted} tiny={true} /> : null}
          </Pressable>
        ))}
      </Box>

      <Box style={{ gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>EXPLORER</Text>
        {props.files.slice(0, fileLimit).map((file: any) => {
          if (file.visible !== 1) return null;
          const gitGutter = gitGutterColor(file.git);
          return (
            <Pressable
              key={file.path + '_' + file.indent}
              onPress={() => props.onSelectPath(file.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 10 + file.indent * 12,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 10,
                backgroundColor: file.selected ? COLORS.panelHover : file.hot ? COLORS.panelRaised : 'transparent',
                borderLeftWidth: gitGutter ? 3 : 0,
                borderColor: gitGutter || 'transparent',
              }}
            >
              <Text fontSize={9} color={COLORS.textDim}>{file.type === 'dir' ? (file.expanded ? 'v' : '>') : ''}</Text>
              <Glyph
                icon={file.type === 'dir' ? (file.expanded ? 'folder-open' : 'folder') : fileGlyph(file.type)}
                tone={file.type === 'dir' ? COLORS.textMuted : fileTone(file.type)}
                backgroundColor={file.type === 'dir' ? COLORS.grayDeep : COLORS.grayChip}
                tiny={true}
              />
              <Text fontSize={11} color={file.selected ? COLORS.textBright : COLORS.text}>{file.name}</Text>
              {file.hot ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} /> : null}
              <Box style={{ flexGrow: 1 }} />
              {file.git ? <Pill label={file.git} color={gitGutter || COLORS.textMuted} tiny={true} /> : null}
            </Pressable>
          );
        })}
      </Box>
    </PanelShell>
  );
}

function SourceControlPanel(props: any) {
  const changes = props.gitChanges.slice(0, props.compactBand ? 10 : 16);
  return (
    <PanelShell
      title="Source Control"
      icon="git"
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
        <Pressable onPress={props.onRefreshWorkspace} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.blue}>Refresh</Text>
        </Pressable>
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

export function Sidebar(props: any) {
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
            <Pressable onPress={props.onRefreshWorkspace}><Text fontSize={10} color={COLORS.blue}>RF</Text></Pressable>
            <Pressable onPress={props.onCreateFile}><Text fontSize={10} color={COLORS.blue}>+</Text></Pressable>
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
                <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
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
        <ScrollView style={{ flexGrow: 1, height: '100%', paddingLeft: 8, paddingRight: 8, paddingBottom: 12 }}>
          <Col style={{ gap: 4 }}>
            {props.files.map((file: any) => {
              if (file.visible !== 1) return null;
              const gitGutter = gitGutterColor(file.git);
              return (
                <Pressable
                  key={file.path + '_' + file.indent}
                  onPress={() => props.onSelectPath(file.path)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 10 + file.indent * 12,
                    paddingRight: 10,
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderRadius: 10,
                    backgroundColor: file.selected ? COLORS.panelHover : file.hot ? COLORS.panelRaised : 'transparent',
                    borderLeftWidth: gitGutter ? 3 : 0,
                    borderColor: gitGutter || 'transparent',
                  }}
                >
                  <Text fontSize={9} color={COLORS.textDim}>{file.type === 'dir' ? (file.expanded ? 'v' : '>') : ''}</Text>
                  <Glyph
                    icon={file.type === 'dir' ? (file.expanded ? 'folder-open' : 'folder') : fileGlyph(file.type)}
                    tone={file.type === 'dir' ? COLORS.textMuted : fileTone(file.type)}
                    backgroundColor={file.type === 'dir' ? COLORS.grayDeep : COLORS.grayChip}
                    tiny={true}
                  />
                  <Text fontSize={11} color={file.selected ? COLORS.textBright : COLORS.text}>{file.name}</Text>
                  {file.hot ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} /> : null}
                  <Box style={{ flexGrow: 1 }} />
                  {file.git ? <Pill label={file.git} color={gitGutter || COLORS.textMuted} tiny={true} /> : null}
                </Pressable>
              );
            })}
          </Col>
        </ScrollView>
      </Col>
    );
  }

  const panelOrder = (props.dockPanels || ['files', 'source-control']).filter((panelId: string, idx: number, list: string[]) => panelId && list.indexOf(panelId) === idx);
  const openEditorCount = props.tabs.filter((tab: any) => tab.path !== '__landing__').length;
  const changeCount = props.gitChanges.length;

  return (
    <Row
      style={{
        width: props.style?.width || 328,
        height: '100%',
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
        <DockButton
          active={panelOrder[0] === 'files'}
          count={String(openEditorCount)}
          icon="folder"
          label="Files"
          tone={COLORS.blue}
          onPress={() => props.onFocusDockPanel('files')}
        />
        <DockButton
          active={panelOrder[0] === 'source-control'}
          count={String(changeCount)}
          icon="git"
          label="Git"
          tone={COLORS.green}
          onPress={() => props.onFocusDockPanel('source-control')}
        />
        <Box style={{ flexGrow: 1 }} />
        <DockButton
          active={false}
          icon="refresh"
          label="Refresh"
          tone={COLORS.blue}
          onPress={props.onRefreshWorkspace}
        />
        <DockButton
          active={false}
          icon="plus"
          label="New"
          tone={COLORS.green}
          onPress={props.onCreateFile}
        />
      </Col>

      <ScrollView style={{ flexGrow: 1, height: '100%' }}>
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
