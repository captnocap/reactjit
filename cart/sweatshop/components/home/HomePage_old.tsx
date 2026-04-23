const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { loadRecents } from '../../lib/workspace/recents';
import { checkIsDirectory, mkdirP } from '../../lib/workspace/validate';

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

function PathInput(props: { value: string; placeholder: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <Box
      style={{
        flexGrow: 1,
        flexBasis: 0,
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

function ActionCard(props: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  button: string;
  error: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Col
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        gap: 10,
        padding: 18,
        borderRadius: TOKENS.radiusLg,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Col style={{ gap: 4 }}>
        <SectionLabel text={props.label} />
        <Text fontSize={10} color={COLORS.textDim}>{props.description}</Text>
      </Col>
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <PathInput
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          onSubmit={props.onSubmit}
        />
        <PrimaryButton label={props.button} onPress={props.onSubmit} />
      </Row>
      {props.error ? (
        <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
          <Text fontSize={10} color={COLORS.red}>{props.error}</Text>
        </Box>
      ) : null}
    </Col>
  );
}

function RecentRow(props: { path: string; onOpen: () => void }) {
  const parts = props.path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || props.path;
  const parent = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '';
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
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{name}</Text>
        {parent ? <Text fontSize={10} color={COLORS.textDim}>{parent}</Text> : null}
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

  useEffect(() => { setRecents(loadRecents()); }, []);

  const tryOpen = () => {
    const trimmed = (openPath || '').trim();
    if (!trimmed) { setOpenError('Enter an absolute path.'); return; }
    const check = checkIsDirectory(trimmed);
    if (!check.ok) { setOpenError(check.reason || 'Invalid path.'); return; }
    setOpenError('');
    props.onOpenWorkspace(trimmed);
  };

  const tryCreate = () => {
    const trimmed = (newDir || '').trim();
    if (!trimmed) { setNewError('Enter an absolute path.'); return; }
    const check = mkdirP(trimmed);
    if (!check.ok) { setNewError(check.reason || 'Failed to create directory.'); return; }
    setNewError('');
    props.onOpenWorkspace(trimmed);
  };

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, width: '100%', backgroundColor: COLORS.appBg }}>
      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, width: '100%' }}>
        <Col style={{ width: '100%', alignItems: 'center', paddingTop: 72, paddingBottom: 72, paddingLeft: 32, paddingRight: 32 }}>
          <Col style={{ width: '100%', maxWidth: 820, gap: 40 }}>
            <Col style={{ gap: 8 }}>
              <Text fontSize={36} color={COLORS.textBright} style={{ fontWeight: 'bold', letterSpacing: -1 }}>sweatshop</Text>
              <Text fontSize={13} color={COLORS.textDim}>A native agent workspace. Pick a working directory to begin.</Text>
            </Col>

            <Col style={{ gap: 12 }}>
              <SectionLabel text="Recent" />
              {recents.length === 0 ? (
                <Box style={{ padding: 20, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                  <Text fontSize={11} color={COLORS.textDim}>No recent workspaces. Open one below.</Text>
                </Box>
              ) : (
                <Box style={{ borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, padding: 8 }}>
                  <ScrollView style={{ maxHeight: 240 }}>
                    <Col style={{ gap: 6 }}>
                      {recents.map((p: string) => (
                        <RecentRow key={p} path={p} onOpen={() => props.onOpenWorkspace(p)} />
                      ))}
                    </Col>
                  </ScrollView>
                </Box>
              )}
            </Col>

            <Row style={{ gap: 16, alignItems: 'stretch' }}>
              <ActionCard
                label="Open Path"
                description="Absolute path to an existing directory."
                value={openPath}
                placeholder="/absolute/path/to/workspace"
                button="Open"
                error={openError}
                onChange={setOpenPath}
                onSubmit={tryOpen}
              />
              <ActionCard
                label="New Directory"
                description="Create a new directory (mkdir -p)."
                value={newDir}
                placeholder="/absolute/path/to/new/workspace"
                button="Create"
                error={newError}
                onChange={setNewDir}
                onSubmit={tryCreate}
              />
            </Row>
          </Col>
        </Col>
      </ScrollView>
    </Box>
  );
}
