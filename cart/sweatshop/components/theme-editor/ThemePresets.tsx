const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS, setCustomOverrides, applyTheme } from '../../theme';
import type { CustomThemeOverrides } from '../../themes';
import { listPresets, loadPreset, savePreset, deletePreset, renamePreset, duplicatePreset } from './useThemeDraft';

function RowButton(props: { label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable onPress={props.onPress}>
      <Box style={{
        paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.panelAlt,
      }}>
        <Text fontSize={9} color={props.tone || COLORS.text}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

export function ThemePresets(props: { currentDraft: CustomThemeOverrides }) {
  const [names, setNames] = useState(() => listPresets());
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const refresh = () => setNames(listPresets());

  const onSave = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    savePreset(trimmed, props.currentDraft);
    setNewName('');
    refresh();
  };

  const onLoad = (name: string) => {
    const data = loadPreset(name);
    if (!data) return;
    setCustomOverrides(data);
    applyTheme('custom');
  };

  const onDelete = (name: string) => { deletePreset(name); refresh(); };

  const commitRename = () => {
    if (!renaming) return;
    const next = renameText.trim();
    if (next && next !== renaming) renamePreset(renaming, next);
    setRenaming(null);
    setRenameText('');
    refresh();
  };

  const onDuplicate = (name: string) => {
    let copy = name + ' copy';
    let suffix = 2;
    while (names.includes(copy)) { copy = name + ' copy ' + (suffix++); }
    duplicatePreset(name, copy);
    refresh();
  };

  return (
    <Col style={{ gap: 6 }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>SAVED THEMES</Text>
      <Row style={{ gap: 6, alignItems: 'center' }}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          style={{
            flexGrow: 1, flexBasis: 0, height: 22,
            paddingLeft: 6, paddingRight: 6,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontUI, fontSize: 10,
          }}
        />
        <RowButton label="Save draft" onPress={onSave} tone={COLORS.blue} />
      </Row>
      <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
        <Col style={{ padding: 4, gap: 3 }}>
          {names.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim} style={{ paddingLeft: 4 }}>No saved themes yet.</Text>
          ) : names.map((name) => (
            <Row key={name} style={{ alignItems: 'center', gap: 4, padding: 3, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelAlt }}>
              {renaming === name ? (
                <TextInput
                  value={renameText}
                  onChangeText={setRenameText}
                  style={{ flexGrow: 1, flexBasis: 0, height: 20, paddingLeft: 4, paddingRight: 4, borderWidth: 1, borderColor: COLORS.blue, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg, fontFamily: TOKENS.fontUI, fontSize: 10 }}
                />
              ) : (
                <Text fontSize={10} color={COLORS.text} style={{ flexGrow: 1, flexBasis: 0, fontFamily: TOKENS.fontUI }}>{name}</Text>
              )}
              {renaming === name ? (
                <RowButton label="ok" onPress={commitRename} tone={COLORS.green} />
              ) : (
                <RowButton label="apply" onPress={() => onLoad(name)} tone={COLORS.blue} />
              )}
              {renaming === name ? null : <RowButton label="rename" onPress={() => { setRenaming(name); setRenameText(name); }} />}
              {renaming === name ? null : <RowButton label="dup" onPress={() => onDuplicate(name)} />}
              {renaming === name ? null : <RowButton label="del" onPress={() => onDelete(name)} tone={COLORS.red} />}
            </Row>
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
