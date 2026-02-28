import React from 'react';
import { Box, Text, Pressable, Modal } from '@reactjit/core';
import { C } from '../theme';
import { THEME_META, ThemeName } from '../themes';

export interface ClaudeSettings {
  model: string;
  workingDir: string;
}

interface Props {
  visible: boolean;
  settings: ClaudeSettings;
  onClose: () => void;
  onChange: (next: ClaudeSettings) => void;
  currentTheme: ThemeName;
  onThemeChange: (name: ThemeName) => void;
}

const MODELS = [
  { id: 'sonnet', label: 'Sonnet 4.6', desc: 'Fast · default' },
  { id: 'opus',   label: 'Opus 4.6',   desc: 'Best · use for debugging' },
  { id: 'haiku',  label: 'Haiku 4.5',  desc: 'Cheap · quick tasks' },
];

const SECTION_LABEL = (label: string) => (
  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold', letterSpacing: 1 }}>
    {label.toUpperCase()}
  </Text>
);

export function SettingsOverlay({ visible, settings, onClose, onChange, currentTheme, onThemeChange }: Props) {
  const setModel = (model: string) => onChange({ ...settings, model });

  return (
    <Modal visible={visible} backdropDismiss onRequestClose={onClose}>
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        width: 480,
        gap: 0,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 20,
          paddingRight: 16,
          paddingTop: 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderColor: C.border,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, color: C.accent }}>{'⚙'}</Text>
            <Text style={{ fontSize: 15, color: C.text, fontWeight: 'bold' }}>{'Claude Code Settings'}</Text>
          </Box>
          <Box style={{
            backgroundColor: C.bg,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: C.border,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'F8 to close'}</Text>
          </Box>
        </Box>

        {/* Model Selection */}
        <Box style={{ padding: 20, gap: 10 }}>
          {SECTION_LABEL('Model')}
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            {MODELS.map(m => {
              const active = settings.model === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setModel(m.id)}
                  style={{
                    flexGrow: 1,
                    backgroundColor: active ? C.accentDim + '22' : C.bg,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? C.accentDim : C.border,
                    paddingTop: 10,
                    paddingBottom: 10,
                    paddingLeft: 12,
                    paddingRight: 12,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 13, color: active ? C.accent : C.text, fontWeight: 'bold' }}>
                    {m.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textDim }}>
                    {m.desc}
                  </Text>
                </Pressable>
              );
            })}
          </Box>
        </Box>

        {/* Divider */}
        <Box style={{ height: 1, backgroundColor: C.border }} />

        {/* Working Directory */}
        <Box style={{ padding: 20, gap: 10 }}>
          {SECTION_LABEL('Working Directory')}
          <Box style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: C.bg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.border,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            gap: 8,
          }}>
            <Text style={{ fontSize: 12, color: C.textDim }}>{'~'}</Text>
            <Text style={{ fontSize: 13, color: C.text, flexGrow: 1 }}>
              {settings.workingDir}
            </Text>
          </Box>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {'Directory is set at launch. Restart the session to change it.'}
          </Text>
        </Box>

        {/* Divider */}
        <Box style={{ height: 1, backgroundColor: C.border }} />

        {/* Theme */}
        <Box style={{ padding: 20, gap: 10 }}>
          {SECTION_LABEL('Theme')}
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            {THEME_META.map(t => {
              const active = currentTheme === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onThemeChange(t.id)}
                  style={{
                    flexGrow: 1,
                    backgroundColor: active ? t.preview : C.bg,
                    borderRadius: 8,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? t.fg : C.border,
                    paddingTop: 10,
                    paddingBottom: 10,
                    paddingLeft: 12,
                    paddingRight: 12,
                    gap: 4,
                  }}
                >
                  {/* Color swatch strip */}
                  <Box style={{ flexDirection: 'row', gap: 3, marginBottom: 4 }}>
                    <Box style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: t.preview, borderWidth: 1, borderColor: t.fg + '44' }} />
                    <Box style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: t.fg + 'cc' }} />
                    <Box style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: t.fg + '55' }} />
                  </Box>
                  <Text style={{ fontSize: 12, color: active ? t.fg : C.text, fontWeight: 'bold' }}>
                    {t.label}
                  </Text>
                  <Text style={{ fontSize: 10, color: active ? t.fg + 'bb' : C.textDim }}>
                    {t.desc}
                  </Text>
                </Pressable>
              );
            })}
          </Box>
        </Box>

        {/* Divider */}
        <Box style={{ height: 1, backgroundColor: C.border }} />

        {/* Info row */}
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          gap: 12,
        }}>
          <Box style={{ flexDirection: 'row', gap: 16 }}>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: C.textMuted }}>{'RENDERER'}</Text>
              <Text style={{ fontSize: 10, color: C.textDim }}>{'Love2D'}</Text>
            </Box>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: C.textMuted }}>{'BRIDGE'}</Text>
              <Text style={{ fontSize: 10, color: C.textDim }}>{'QuickJS'}</Text>
            </Box>
          </Box>

          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: C.bg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: C.border,
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <Text style={{ fontSize: 13, color: C.text }}>{'Close'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}
