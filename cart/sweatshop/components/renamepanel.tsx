const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';
import { applyRenamePreview, buildRenamePreview, type RenamePreview } from '../rename';

export function RenamePanel(props: { workDir: string; onApplied?: () => void }) {
  const [path, setPath] = useState('');
  const [line, setLine] = useState('1');
  const [column, setColumn] = useState('1');
  const [replacement, setReplacement] = useState('');
  const [preview, setPreview] = useState<RenamePreview | null>(null);
  const [selectedHits, setSelectedHits] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('Choose a symbol location to preview rename usages.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const lineNumber = Number.parseInt(line, 10);
    const columnNumber = Number.parseInt(column, 10);
    const nextReplacement = replacement.trim();
    const nextPath = path.trim();

    if (!nextPath || !Number.isFinite(lineNumber) || !Number.isFinite(columnNumber) || lineNumber <= 0 || columnNumber <= 0) {
      setPreview(null);
      setSelectedHits({});
      setStatus('Enter a file path, line, column, and replacement name.');
      return;
    }

    if (!nextReplacement) {
      setPreview(null);
      setSelectedHits({});
      setStatus('Enter the replacement name to build a preview.');
      return;
    }

    const next = buildRenamePreview(props.workDir, nextPath, lineNumber, columnNumber, nextReplacement);
    setPreview(next);
    const initial: Record<string, boolean> = {};
    for (const group of next.groups) {
      for (const hit of group.hits) {
        initial[hit.id] = true;
      }
    }
    setSelectedHits(initial);
    if (next.error) {
      setStatus(next.error);
    } else if (next.totalHits === 0) {
      setStatus(`Resolved ${next.selection.name}, but no usages were found.`);
    } else {
      setStatus(`Previewing ${next.totalHits} usage${next.totalHits !== 1 ? 's' : ''} for ${next.selection.name}.`);
    }
  }, [props.workDir, path, line, column, replacement]);

  function setAllHits(groupPath: string, value: boolean) {
    if (!preview) return;
    const next = { ...selectedHits };
    for (const group of preview.groups) {
      if (group.path !== groupPath) continue;
      for (const hit of group.hits) {
        next[hit.id] = value;
      }
    }
    setSelectedHits(next);
  }

  function setHitSelected(id: string, value: boolean) {
    setSelectedHits((prev) => ({ ...prev, [id]: value }));
  }

  async function applyRename() {
    if (!preview || preview.error || busy) return;
    setBusy(true);
    try {
      const result = applyRenamePreview(preview, selectedHits);
      if (result.ok) {
        setStatus(`Wrote ${result.filesWritten} file${result.filesWritten !== 1 ? 's' : ''} and ${result.hitsWritten} hit${result.hitsWritten !== 1 ? 's' : ''}.`);
      } else {
        setStatus(result.errors.join(' | '));
      }
      props.onApplied?.();
    } finally {
      setBusy(false);
    }
  }

  const totalSelected = preview
    ? preview.groups.reduce((sum, group) => sum + group.hits.filter((hit) => selectedHits[hit.id] !== false).length, 0)
    : 0;

  return (
    <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Rename Preview</Text>
        <Pill label="symbol -> usages" color={COLORS.purple} tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>
        Enter a source symbol location, preview grouped usages, toggle individual hits, then apply the rename stub.
      </Text>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <TextInput
          value={path}
          onChangeText={setPath}
          placeholder="file path"
          style={{ minWidth: 240, flexGrow: 1, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <TextInput
          value={line}
          onChangeText={setLine}
          placeholder="line"
          style={{ width: 72, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <TextInput
          value={column}
          onChangeText={setColumn}
          placeholder="col"
          style={{ width: 72, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
      </Row>

      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextInput
          value={replacement}
          onChangeText={setReplacement}
          placeholder="replacement name"
          style={{ minWidth: 220, flexGrow: 1, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <Pressable
          onPress={applyRename}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 7,
            paddingBottom: 7,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: COLORS.blue,
            backgroundColor: busy ? COLORS.panelAlt : COLORS.blueDeep,
          }}
        >
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{busy ? 'Applying...' : 'Apply Rename'}</Text>
        </Pressable>
      </Row>

      <Text fontSize={10} color={COLORS.textDim}>{status}</Text>
      {preview?.error ? (
        <Box style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
          <Text fontSize={10} color={COLORS.red}>{preview.error}</Text>
        </Box>
      ) : null}

      {preview && !preview.error ? (
        <Col style={{ gap: 10 }}>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label={`${preview.totalHits} hit${preview.totalHits !== 1 ? 's' : ''}`} color={COLORS.green} tiny={true} />
            <Pill label={`${totalSelected} selected`} color={COLORS.blue} tiny={true} />
            <Pill label={`${preview.selection.kind} ${preview.selection.name}`} color={COLORS.purple} tiny={true} />
            <Pill label={`${preview.selection.path}:${preview.selection.lineNumber}:${preview.selection.columnNumber}`} tiny={true} />
          </Row>

          <Box style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 4 }}>
            <Text fontSize={10} color={COLORS.textDim}>Resolved symbol</Text>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{preview.selection.sourceLineText || preview.selection.name}</Text>
          </Box>

          <ScrollView style={{ maxHeight: 260 }}>
            <Col style={{ gap: 8 }}>
              {preview.groups.map((group) => {
                const selectedCount = group.hits.filter((hit) => selectedHits[hit.id] !== false).length;
                return (
                  <Box key={group.path} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 8 }}>
                    <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>
                        {group.path}
                      </Text>
                      <Pill label={`${selectedCount}/${group.hits.length}`} tiny={true} />
                      <Pressable onPress={() => setAllHits(group.path, true)} style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep }}>
                        <Text fontSize={9} color={COLORS.green}>confirm all</Text>
                      </Pressable>
                      <Pressable onPress={() => setAllHits(group.path, false)} style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
                        <Text fontSize={9} color={COLORS.red}>skip all</Text>
                      </Pressable>
                    </Row>

                    <Col style={{ gap: 6 }}>
                      {group.hits.map((hit) => {
                        const selected = selectedHits[hit.id] !== false;
                        return (
                          <Pressable
                            key={hit.id}
                            onPress={() => setHitSelected(hit.id, !selected)}
                            style={{
                              padding: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: selected ? COLORS.green : COLORS.border,
                              backgroundColor: selected ? COLORS.greenDeep : COLORS.panelRaised,
                              gap: 4,
                            }}
                          >
                            <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
                                {hit.lineNumber}:{hit.columnNumber}
                              </Text>
                              <Pill label={hit.role} color={hit.role === 'definition' ? COLORS.yellow : COLORS.blue} tiny={true} />
                              <Pill label={selected ? 'confirm' : 'skip'} color={selected ? COLORS.green : COLORS.textDim} tiny={true} />
                            </Row>
                            <Text fontSize={10} color={COLORS.text}>{hit.snippet}</Text>
                          </Pressable>
                        );
                      })}
                    </Col>
                  </Box>
                );
              })}
            </Col>
          </ScrollView>
        </Col>
      ) : null}
    </Box>
  );
}
