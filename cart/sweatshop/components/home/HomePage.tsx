const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { loadRecents } from '../../lib/workspace/recents';
import { checkIsDirectory, mkdirP } from '../../lib/workspace/validate';
import { DirectoryPicker } from './DirectoryPicker';
import { envGet } from '../../../../runtime/hooks/process';

function log(message: string): void {
  try {
    const h = globalThis as any;
    if (typeof h.__hostLog === 'function') h.__hostLog(0, '[home] ' + message);
    else if (typeof console !== 'undefined' && console.log) console.log('[home] ' + message);
  } catch (_e) {}
}

type HomePageProps = {
  onOpenWorkspace: (path: string) => void;
};

function SectionLabel(props: { text: string }) {
  return (
    <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold', letterSpacing: 1 }}>
      {props.text.toUpperCase()}
    </Text>
  );
}

function PrimaryButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 9,
        paddingBottom: 9,
        borderRadius: TOKENS.radiusSm,
        backgroundColor: COLORS.blueDeep,
        borderWidth: 1,
        borderColor: COLORS.blue,
      }}
    >
      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </Pressable>
  );
}

function BrowseButton(props: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 9,
        paddingBottom: 9,
        borderRadius: TOKENS.radiusSm,
        backgroundColor: COLORS.panelAlt,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label || 'Browse...'}</Text>
    </Pressable>
  );
}

function PathInput(props: { value: string; placeholder: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: TOKENS.radiusSm,
        backgroundColor: COLORS.panelRaised,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 9,
        paddingBottom: 9,
      }}
    >
      <TextInput
        value={props.value}
        onChange={props.onChange}
        onSubmit={props.onSubmit}
        placeholder={props.placeholder}
        fontSize={11}
        color={COLORS.text}
        style={{ borderWidth: 0, backgroundColor: 'transparent' }}
      />
    </Box>
  );
}

function RecentRow(props: { path: string; onOpen: () => void }) {
  return (
    <Pressable
      onPress={props.onOpen}
      style={{
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: TOKENS.radiusSm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.panelAlt,
      }}
    >
      <Col style={{ gap: 2 }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{props.path}</Text>
      </Col>
    </Pressable>
  );
}

export function HomePage(props: HomePageProps) {
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [openPath, setOpenPath] = useState('');
  const [openError, setOpenError] = useState('');
  const [newDir, setNewDir] = useState('');
  const [newError, setNewError] = useState('');
  const [newParentPath, setNewParentPath] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'open' | 'new'>('open');

  const homePath = (typeof envGet === 'function' ? envGet('HOME') : null) || '/';

  useEffect(() => { setRecents(loadRecents()); }, []);

  const tryOpen = (path?: string) => {
    const target = (path ?? openPath ?? '').trim();
    log('tryOpen target=' + target + ' source=' + (path ? 'arg' : 'input'));
    if (!target) { setOpenError('Enter an absolute path.'); return; }
    const check = checkIsDirectory(target);
    if (!check.ok) { log('tryOpen invalid target=' + target + ' reason=' + (check.reason || '')); setOpenError(check.reason || 'Invalid path.'); return; }
    setOpenError('');
    log('tryOpen ok target=' + target);
    props.onOpenWorkspace(target);
  };

  const tryCreate = (path?: string) => {
    const target = (path ?? newDir ?? '').trim();
    if (!target) { setNewError('Enter an absolute path.'); return; }
    const check = mkdirP(target);
    if (!check.ok) { setNewError(check.reason || 'Failed to create directory.'); return; }
    setNewError('');
    props.onOpenWorkspace(target);
  };

  const tryCreateFromParent = () => {
    const name = (newDirName || '').trim();
    if (!name) { setNewError('Enter a directory name.'); return; }
    if (name.includes('/')) { setNewError('Name must not contain slashes.'); return; }
    const fullPath = newParentPath.replace(/\/+$/, '') + '/' + name;
    const check = mkdirP(fullPath);
    if (!check.ok) { setNewError(check.reason || 'Failed to create directory.'); return; }
    setNewError('');
    props.onOpenWorkspace(fullPath);
  };

  const openPicker = (mode: 'open' | 'new') => {
    log('openPicker mode=' + mode + ' start=' + homePath);
    setPickerMode(mode);
    setPickerVisible(true);
  };

  const handlePickerSelect = (path: string) => {
    log('pickerSelect mode=' + pickerMode + ' path=' + path);
    setPickerVisible(false);
    if (pickerMode === 'open') {
      setOpenPath(path);
      tryOpen(path);
    } else {
      setNewParentPath(path);
      setNewDirName('');
    }
  };

  return (
    <Col style={{ flex: 1, width: '100%', alignItems: 'center', backgroundColor: COLORS.appBg }}>
      <ScrollView style={{ flex: 1, width: '100%' }}>
        <Col style={{ width: '100%', alignItems: 'center' }}>
          <Col style={{ width: 760, gap: 40, paddingTop: 72, paddingBottom: 72 }}>
            <Col style={{ gap: 8 }}>
              <Text fontSize={30} color={COLORS.textBright} style={{ fontWeight: 'bold', letterSpacing: -1 }}>sweatshop</Text>
              <Text fontSize={13} color={COLORS.textDim}>A native agent workspace. Pick a working directory to begin.</Text>
            </Col>

            <Col style={{ gap: 12 }}>
              <SectionLabel text="Recent" />
              {recents.length === 0 ? (
                <Text fontSize={13} color={COLORS.textDim}>No recent workspaces. Open one below.</Text>
              ) : (
                <Col style={{ gap: 6 }}>
                  {recents.map((p: string) => (
                    <RecentRow key={p} path={p} onOpen={() => props.onOpenWorkspace(p)} />
                  ))}
                </Col>
              )}
            </Col>

            <Row style={{ gap: 24, alignItems: 'stretch' }}>
              {/* Open Path card */}
              <Col
                style={{
                  flex: 1,
                  minWidth: 0,
                  gap: 10,
                  padding: 20,
                  borderRadius: TOKENS.radiusLg,
                  backgroundColor: COLORS.panelRaised,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Col style={{ gap: 4 }}>
                  <SectionLabel text="Open Path" />
                  <Text fontSize={10} color={COLORS.textDim}>Absolute path to an existing directory.</Text>
                </Col>
                <Row style={{ gap: 12, alignItems: 'center' }}>
                  <PathInput
                    value={openPath}
                    placeholder="/absolute/path/to/workspace"
                    onChange={setOpenPath}
                    onSubmit={() => tryOpen()}
                  />
                  <BrowseButton label="Pick..." onPress={() => openPicker('open')} />
                  <PrimaryButton label="Open" onPress={() => tryOpen()} />
                </Row>
                {openError ? (
                  <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
                    <Text fontSize={10} color={COLORS.red}>{openError}</Text>
                  </Box>
                ) : null}
              </Col>

              {/* New Directory card */}
              <Col
                style={{
                  flex: 1,
                  minWidth: 0,
                  gap: 10,
                  padding: 20,
                  borderRadius: TOKENS.radiusLg,
                  backgroundColor: COLORS.panelRaised,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Col style={{ gap: 4 }}>
                  <SectionLabel text="Create Directory" />
                  <Text fontSize={10} color={COLORS.textDim}>Create a new directory (mkdir -p).</Text>
                </Col>
                {newParentPath ? (
                  <Col style={{ gap: 10 }}>
                    <Text fontSize={11} color={COLORS.textMuted}>Parent: {newParentPath}</Text>
                    <Row style={{ gap: 12, alignItems: 'center' }}>
                      <Box
                        style={{
                          flex: 1,
                          minWidth: 0,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          borderRadius: TOKENS.radiusSm,
                          backgroundColor: COLORS.panelRaised,
                          paddingLeft: 12,
                          paddingRight: 12,
                          paddingTop: 9,
                          paddingBottom: 9,
                        }}
                      >
                        <TextInput
                          value={newDirName}
                          onChange={setNewDirName}
                          onSubmit={tryCreateFromParent}
                          placeholder="directory-name"
                          fontSize={11}
                          color={COLORS.text}
                          style={{ borderWidth: 0, backgroundColor: 'transparent' }}
                        />
                      </Box>
                      <PrimaryButton label="Create and Open" onPress={tryCreateFromParent} />
                    </Row>
                    <Pressable onPress={() => { setNewParentPath(''); setNewError(''); }}>
                      <Text fontSize={10} color={COLORS.blue}>Back to full path entry</Text>
                    </Pressable>
                  </Col>
                ) : (
                  <Row style={{ gap: 12, alignItems: 'center' }}>
                    <PathInput
                      value={newDir}
                      placeholder="/absolute/path/to/new/workspace"
                      onChange={setNewDir}
                      onSubmit={() => tryCreate()}
                    />
                    <BrowseButton label="Parent..." onPress={() => openPicker('new')} />
                    <PrimaryButton label="Create and Open" onPress={() => tryCreate()} />
                  </Row>
                )}
                {newError ? (
                  <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
                    <Text fontSize={10} color={COLORS.red}>{newError}</Text>
                  </Box>
                ) : null}
              </Col>
            </Row>
          </Col>
        </Col>
      </ScrollView>
      <DirectoryPicker
        visible={pickerVisible}
        startPath={homePath}
        title={pickerMode === 'open' ? 'Open Workspace' : 'Choose Parent Folder'}
        subtitle={pickerMode === 'open' ? 'Navigate into folders, then open the current folder as the workspace.' : 'Navigate into folders, then use the current folder as the parent for a new workspace.'}
        confirmLabel={pickerMode === 'open' ? 'Open workspace' : 'Use as parent'}
        allowCreate={pickerMode === 'new'}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerVisible(false)}
      />
    </Col>
  );
}
