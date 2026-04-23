const React: any = require('react');
const { useState, useEffect, useMemo, useRef } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { listDir, stat } from '../../../../runtime/hooks/fs';
import { checkIsDirectory, mkdirP } from '../../lib/workspace/validate';
import { fuzzyScore } from '../palette/useFuzzyFilter';

function log(message: string): void {
  try {
    const h = globalThis as any;
    if (typeof h.__hostLog === 'function') h.__hostLog(0, '[picker] ' + message);
    else if (typeof console !== 'undefined' && console.log) console.log('[picker] ' + message);
  } catch (_e) {}
}

function isValidSegment(name: string): boolean {
  if (!name) return false;
  if (name === '.' || name === '..') return false;
  if (name.indexOf('/') >= 0) return false;
  return true;
}

type DirectoryPickerProps = {
  visible: boolean;
  startPath: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  allowCreate?: boolean;
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
  const currentPathRef = useRef(props.startPath);
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const setPath = (path: string) => {
    currentPathRef.current = path;
    setCurrentPath(path);
  };

  useEffect(() => {
    if (props.visible) {
      log('open startPath=' + props.startPath + ' title=' + props.title);
      setPath(props.startPath);
      setQuery('');
      refreshEntries(props.startPath);
    }
  }, [props.visible, props.startPath]);

  const refreshEntries = (path: string) => {
    log('refresh path=' + path);
    try {
      const names = listDir(path);
      if (!names || names.length === 0) {
        setEntries([]);
        setError('No entries (empty directory or permission denied).');
        log('refresh empty path=' + path);
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
      log('refresh done path=' + path + ' dirs=' + dirs.length + (dirs[0] ? ' first=' + dirs[0] : ''));
    } catch (_e) {
      setEntries([]);
      setError('Could not read directory.');
      log('refresh failed path=' + path);
    }
  };

  const goUp = () => {
    const from = currentPathRef.current;
    const normalized = from.replace(/\/+$/, '');
    if (normalized === '' || normalized === '/') return;
    const parent = normalized.split('/').slice(0, -1).join('/') || '/';
    log('goUp from=' + from + ' to=' + parent);
    setPath(parent);
    setQuery('');
    refreshEntries(parent);
  };

  const goDown = (name: string) => {
    const from = currentPathRef.current;
    const base = from.replace(/\/+$/, '');
    const next = (base === '' ? '' : base) + '/' + name;
    log('goDown name=' + name + ' from=' + from + ' to=' + next);
    setPath(next);
    setQuery('');
    refreshEntries(next);
  };

  const goToSegment = (idx: number) => {
    const from = currentPathRef.current;
    const parts = from.split('/').filter(Boolean);
    const next = '/' + parts.slice(0, idx + 1).join('/');
    log('goToSegment idx=' + idx + ' from=' + from + ' to=' + next);
    setPath(next);
    setQuery('');
    refreshEntries(next);
  };

  const filteredEntries = useMemo(() => {
    const q = (query || '').trim();
    return q.length === 0
      ? entries
      : entries
        .map((name: string) => ({ name, score: fuzzyScore(q, name, 'loose') }))
        .filter((item: { name: string; score: number }) => item.score > 0)
        .sort((a: { name: string; score: number }, b: { name: string; score: number }) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.name.localeCompare(b.name);
        })
        .map((item: { name: string; score: number }) => item.name);
  }, [query, entries]);

  const selectQuery = () => {
    const q = (query || '').trim();
    const selectedPath = currentPathRef.current;
    log('selectQuery current=' + selectedPath + ' query=' + q + ' filtered=' + filteredEntries.length);
    if (!q) {
      log('select current=' + selectedPath);
      props.onSelect(selectedPath);
      return;
    }
    if (filteredEntries.length > 0) {
      log('selectQuery best=' + filteredEntries[0]);
      goDown(filteredEntries[0]);
      return;
    }
    if (q.startsWith('/') || q.startsWith('~/')) {
      const target = q.startsWith('~/') ? props.startPath.replace(/\/+$/, '') + '/' + q.slice(2) : q;
      const check = checkIsDirectory(target);
      if (!check.ok) { setError(check.reason || 'Invalid path.'); return; }
      log('selectQuery absolute target=' + target);
      setPath(target);
      setQuery('');
      refreshEntries(target);
      return;
    }
    if (props.allowCreate && isValidSegment(q)) {
      const base = currentPathRef.current.replace(/\/+$/, '');
      const target = (base === '' ? '' : base) + '/' + q;
      const check = mkdirP(target);
      if (!check.ok) { setError(check.reason || 'Failed to create directory.'); return; }
      log('selectQuery create target=' + target);
      props.onSelect(target);
      return;
    }
    setError(props.allowCreate ? 'Invalid name - single-segment only.' : 'No matching directory.');
  };

  const filteredRows = useMemo(() => {
    const q = (query || '').trim();
    const rows: any[] = filteredEntries.map((name: string) => (
      <DirRow key={name} name={name} onPress={() => goDown(name)} />
    ));
    if (q.length > 0 && filteredEntries.length === 0) {
      if (q.startsWith('/') || q.startsWith('~/')) {
        const target = q.startsWith('~/') ? props.startPath.replace(/\/+$/, '') + '/' + q.slice(2) : q;
        const check = checkIsDirectory(target);
        rows.push(
          <Pressable
            key="__path__"
            onPress={() => {
              if (!check.ok) { setError(check.reason || 'Invalid path.'); return; }
              log('path row target=' + target);
              setPath(target);
              setQuery('');
              refreshEntries(target);
            }}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: check.ok ? COLORS.blue : COLORS.red,
              backgroundColor: check.ok ? COLORS.blueDeep : COLORS.redDeep,
            }}
          >
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{check.ok ? 'Go to ' + target : check.reason || 'Invalid path'}</Text>
          </Pressable>
        );
      } else if (props.allowCreate && isValidSegment(q)) {
        const base = currentPath.replace(/\/+$/, '');
        const target = (base === '' ? '' : base) + '/' + q;
        rows.push(
          <Pressable
            key="__create__"
            onPress={() => {
              const check = mkdirP(target);
              if (!check.ok) { setError(check.reason || 'Failed to create directory.'); return; }
              log('create row target=' + target);
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
            <Text fontSize={11} color={COLORS.red}>{props.allowCreate ? 'Invalid name - single-segment only.' : 'No matching directory.'}</Text>
          </Box>
        );
      }
    }
    return rows;
  }, [query, filteredEntries, currentPath, props.startPath, props.allowCreate]);

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
              <Col style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
                <Text fontSize={10} color={COLORS.textDim}>{props.subtitle}</Text>
              </Col>
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
            <Row style={{ width: '100%', minWidth: 0, gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pressable onPress={() => { setCurrentPath('/'); setQuery(''); refreshEntries('/'); }} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm }}>
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
                onChangeText={setQuery}
                onSubmit={selectQuery}
                onSubmitEditing={selectQuery}
                placeholder={props.allowCreate ? 'fuzzy filter, absolute path, or new name...' : 'fuzzy filter or absolute path...'}
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
              onPress={() => {
                const selectedPath = currentPathRef.current;
                log('confirm current=' + selectedPath + ' state=' + currentPath + ' query=' + (query || '').trim());
                props.onSelect(selectedPath);
              }}
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
