const React: any = require('react');
const { useState, useEffect, useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { listDir, stat } from '../../../../runtime/hooks/fs';
import { mkdirP } from '../../lib/workspace/validate';

function isValidSegment(name: string): boolean {
  if (!name) return false;
  if (name === '.' || name === '..') return false;
  if (name.indexOf('/') >= 0) return false;
  return true;
}

type DirectoryPickerProps = {
  visible: boolean;
  startPath: string;
  confirmLabel: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
};

function DirRow(props: { name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: TOKENS.radiusSm,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: COLORS.panelBg,
      }}
    >
      <Text fontSize={12} color={COLORS.textBright}>{props.name}</Text>
    </Pressable>
  );
}

export function DirectoryPicker(props: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState(props.startPath);
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (props.visible) {
      setCurrentPath(props.startPath);
      setQuery('');
      refreshEntries(props.startPath);
    }
  }, [props.visible, props.startPath]);

  const refreshEntries = (path: string) => {
    try {
      const names = listDir(path);
      if (!names || names.length === 0) {
        setEntries([]);
        setError('No entries (empty directory or permission denied).');
        return;
      }
      const dirs: string[] = [];
      for (const name of names) {
        if (name === '.' || name === '..') continue;
        if (name.startsWith('.')) continue;
        const s = stat(path + '/' + name);
        if (s && s.isDir) dirs.push(name);
      }
      dirs.sort((a, b) => a.localeCompare(b));
      setEntries(dirs);
      setError('');
    } catch (_e) {
      setEntries([]);
      setError('Could not read directory.');
    }
  };

  const goUp = () => {
    const normalized = currentPath.replace(/\/+$/, '');
    if (normalized === '' || normalized === '/') return;
    const parent = normalized.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    refreshEntries(parent);
  };

  const goDown = (name: string) => {
    const base = currentPath.replace(/\/+$/, '');
    const next = (base === '' ? '' : base) + '/' + name;
    setCurrentPath(next);
    refreshEntries(next);
  };

  const goToSegment = (idx: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const next = '/' + parts.slice(0, idx + 1).join('/');
    setCurrentPath(next);
    refreshEntries(next);
  };

  const filteredRows = useMemo(() => {
    const q = (query || '').trim();
    const qLower = q.toLowerCase();
    const filtered = q.length === 0
      ? entries
      : entries.filter((n: string) => n.toLowerCase().indexOf(qLower) >= 0);
    const rows: any[] = filtered.map((name: string) => (
      <DirRow key={name} name={name} onPress={() => goDown(name)} />
    ));
    if (q.length > 0 && filtered.length === 0) {
      if (isValidSegment(q)) {
        const base = currentPath.replace(/\/+$/, '');
        const target = (base === '' ? '' : base) + '/' + q;
        rows.push(
          <Pressable
            key="__create__"
            onPress={() => {
              const check = mkdirP(target);
              if (!check.ok) { setError(check.reason || 'Failed to create directory.'); return; }
              props.onSelect(target);
            }}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: COLORS.blue,
              backgroundColor: COLORS.blueDeep,
            }}
          >
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{'Create directory "' + q + '"'}</Text>
          </Pressable>
        );
      } else {
        rows.push(
          <Box key="__invalid__" style={{ padding: 12, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
            <Text fontSize={11} color={COLORS.red}>Invalid name - single-segment only.</Text>
          </Box>
        );
      }
    }
    return rows;
  }, [query, entries, currentPath]);

  if (!props.visible) return null;

  const parts = currentPath.split('/').filter(Boolean);

  return (
    <Box
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: TOKENS.zModal,
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
    >
      <Pressable
        onPress={props.onCancel}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
        }}
      />
      <Col
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Col
          style={{
            width: 600,
            height: 560,
            maxHeight: 560,
            backgroundColor: COLORS.panelRaised,
            borderRadius: TOKENS.radiusLg,
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: 'hidden',
          }}
        >
          <Col
            style={{
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 12,
              paddingBottom: 12,
              gap: 10,
              borderBottomWidth: 1,
              borderColor: COLORS.border,
              flexShrink: 0,
            }}
          >
            <Row style={{ gap: 8, alignItems: 'center' }}>
              <Row style={{ flex: 1, minWidth: 0, gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pressable onPress={() => { setCurrentPath('/'); refreshEntries('/'); }} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm }}>
                  <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>/</Text>
                </Pressable>
                {parts.map((part: string, idx: number) => (
                  <Row key={idx} style={{ gap: 2, alignItems: 'center' }}>
                    <Text fontSize={11} color={COLORS.textDim}>/</Text>
                    <Pressable onPress={() => goToSegment(idx)} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm }}>
                      <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{part}</Text>
                    </Pressable>
                  </Row>
                ))}
              </Row>
              <Pressable
                onPress={props.onCancel}
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderRadius: TOKENS.radiusSm,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.panelBg,
                }}
              >
                <Text fontSize={11} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>X</Text>
              </Pressable>
            </Row>
            <Box
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: TOKENS.radiusSm,
                backgroundColor: COLORS.panelBg,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 7,
              }}
            >
              <TextInput
                value={query}
                onChange={setQuery}
                placeholder="filter / type a new name…"
                autoFocus={true}
                fontSize={11}
                color={COLORS.text}
                style={{ borderWidth: 0, backgroundColor: 'transparent' }}
              />
            </Box>
          </Col>

          <Box
            style={{
              flex: 1,
              flexBasis: 0,
              minHeight: 0,
              width: '100%',
              overflow: 'hidden',
            }}
          >
            <ScrollView style={{ flex: 1, flexBasis: 0, minHeight: 0, width: '100%' }}>
              <Col style={{ padding: 10, gap: 4 }}>
                {currentPath !== '/' ? (
                  <DirRow name=".." onPress={goUp} />
                ) : null}
                {error ? (
                  <Box style={{ padding: 12, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
                    <Text fontSize={11} color={COLORS.red}>{error}</Text>
                  </Box>
                ) : null}
                {filteredRows}
              </Col>
            </ScrollView>
          </Box>

          <Row
            style={{
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 12,
              paddingBottom: 12,
              gap: 10,
              justifyContent: 'flex-end',
              borderTopWidth: 1,
              borderColor: COLORS.border,
              flexShrink: 0,
            }}
          >
            <Pressable
              onPress={props.onCancel}
              style={{
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: TOKENS.radiusSm,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.panelBg,
              }}
            >
              <Text fontSize={11} color={COLORS.text}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => props.onSelect(currentPath)}
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
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.confirmLabel}</Text>
            </Pressable>
          </Row>
        </Col>
      </Col>
    </Box>
  );
}
