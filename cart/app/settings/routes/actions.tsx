// Actions route — bind app roles to specific models from the registry.
//
// Each role declares a required modality. The picker only lists models
// whose modality matches. Selections persist on the singleton settings
// row at `actionDefaults[<roleId>]`.

import { useState } from 'react';
import { Box, Pressable, ScrollView } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { Icon } from '@reactjit/runtime/icons/Icon';
import { Check, X, ChevronDown } from '@reactjit/runtime/icons/icons';
import { ProviderIcon } from '../../gallery/components/model-card/ProviderIcon';
import { PROVIDER_ICONS } from '../../gallery/components/model-card/providerIcons.generated';
import { Section, SETTINGS_ID } from '../shared';
import { useSettingsCtx } from '../page';
import { MODALITY_LABEL, type Modality } from '../lib/modelRegistry';

type Role = {
  id: string;
  label: string;
  description: string;
  modality: Modality;
};

const ROLES: Role[] = [
  { id: 'assistant',       label: 'Assistant',         description: 'Main chat',                  modality: 'text' },
  { id: 'supervisor',      label: 'Supervisor',        description: 'Planning / orchestration',   modality: 'text' },
  { id: 'embedding',       label: 'Embedding',         description: 'Vectorize for search & RAG', modality: 'embed' },
  { id: 'memory',          label: 'Memory',            description: 'Summarize / recall history', modality: 'text' },
  { id: 'titleGen',        label: 'Title generation',  description: 'Auto-name new threads',      modality: 'text' },
  { id: 'voiceTranscribe', label: 'Voice transcribe',  description: 'Speech → text',              modality: 'voice' },
  { id: 'voiceSpeak',      label: 'Voice speak',       description: 'Text → speech',              modality: 'tts' },
  { id: 'imageGen',        label: 'Image generation',  description: 'Generate images',            modality: 'image' },
];

function modelLabel(m: any): string {
  return m?.displayName || m?.remoteId || '(unknown)';
}

export default function ActionsRoute() {
  const { settings, models, connections, settingsStore, reload } = useSettingsCtx();
  const bindings: Record<string, string> = settings?.actionDefaults || {};
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

  const setBinding = async (roleId: string, modelId: string | null) => {
    const next = { ...(settings?.actionDefaults || {}) };
    if (modelId) next[roleId] = modelId;
    else delete next[roleId];
    if (settings) {
      await settingsStore.update(SETTINGS_ID, { ...settings, actionDefaults: next });
    } else {
      await settingsStore.create({ id: SETTINGS_ID, actionDefaults: next } as any);
    }
    setOpenRoleId(null);
    reload();
  };

  const connFor = (cid: string) => connections.find((c: any) => c.id === cid);

  return (
    <Section caption="Defaults" title="Actions">
      <S.BodyDim>
        Bind each role to a specific model. Picking a role lists every model whose modality
        matches. Roles without a binding fall back to the first compatible model at runtime.
      </S.BodyDim>

      <S.Card>
        <Box style={{ flexDirection: 'column' }}>
          {ROLES.map((r, idx) => {
            const bound = bindings[r.id];
            const m = bound ? models.find((mm: any) => mm.id === bound) : null;
            const matching = models.filter((mm: any) => mm.modality === r.modality);
            const isOpen = openRoleId === r.id;
            const conn = m ? connFor(m.connectionId) : null;
            return (
              <Box key={r.id} style={{
                flexDirection: 'column', gap: 10,
                paddingTop: idx === 0 ? 0 : 14,
                paddingBottom: 14,
                borderBottomWidth: idx === ROLES.length - 1 ? 0 : 1,
                borderBottomColor: 'theme:rule',
              }}>
                {/* Row header — label + current binding + pick + clear */}
                <Box style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <Box style={{ flexGrow: 1, flexShrink: 1, flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <S.Subheading>{r.label}</S.Subheading>
                    <S.Caption>{r.description} · {MODALITY_LABEL[r.modality]}</S.Caption>
                  </Box>

                  <Box style={{ flexDirection: 'row', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                    <Pressable onPress={() => setOpenRoleId(isOpen ? null : r.id)}>
                      <Box style={{
                        flexDirection: 'row', alignItems: 'center', gap: 8,
                        paddingLeft: 14, paddingRight: 16, paddingTop: 9, paddingBottom: 9,
                        borderRadius: 'theme:radiusMd',
                        borderWidth: 1, borderColor: 'theme:rule',
                        backgroundColor: 'theme:bg2',
                        width: 280,
                      }}>
                        {conn?.iconId && PROVIDER_ICONS[conn.iconId] ? (
                          <ProviderIcon providerId={conn.iconId} size={18} />
                        ) : (
                          <Box style={{ width: 18, height: 18, flexShrink: 0 }} />
                        )}
                        <Box style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                          <S.ButtonOutlineLabel noWrap>
                            {m ? modelLabel(m) : '— pick a model —'}
                          </S.ButtonOutlineLabel>
                        </Box>
                        <Icon icon={ChevronDown} size={13} color="theme:inkDim" strokeWidth={2} />
                      </Box>
                    </Pressable>

                    {m && (
                      <Pressable onPress={() => setBinding(r.id, null)} tooltip="Clear binding">
                        <Box style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          width: 36, height: 36,
                          borderRadius: 'theme:radiusMd',
                          borderWidth: 1, borderColor: 'theme:rule',
                          backgroundColor: 'theme:bg2',
                        }}>
                          <Icon icon={X} size={13} color="theme:inkDim" strokeWidth={2} />
                        </Box>
                      </Pressable>
                    )}
                  </Box>
                </Box>

                {/* Expanded picker — list of matching models */}
                {isOpen && (
                  <Box style={{
                    flexDirection: 'column',
                    paddingTop: 6, paddingBottom: 6,
                    paddingLeft: 6, paddingRight: 6,
                    borderRadius: 'theme:radiusMd',
                    backgroundColor: 'theme:bg2',
                    borderWidth: 1, borderColor: 'theme:rule',
                    maxHeight: 320,
                  }}>
                    {matching.length === 0 ? (
                      <Box style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8 }}>
                        <S.BodyDim>
                          No {MODALITY_LABEL[r.modality].toLowerCase()} models available.
                          Add a provider, then refetch in Models.
                        </S.BodyDim>
                      </Box>
                    ) : (
                      <ScrollView style={{ width: '100%', height: 308 }} showScrollbar>
                        <Box style={{ flexDirection: 'column', gap: 2, paddingTop: 4, paddingBottom: 4 }}>
                          {matching.map((opt: any) => {
                            const isSelected = opt.id === bound;
                            const optConn = connFor(opt.connectionId);
                            return (
                              <Pressable key={opt.id} onPress={() => setBinding(r.id, opt.id)}>
                                <Box style={{
                                  flexDirection: 'row', gap: 10, alignItems: 'center',
                                  paddingTop: 8, paddingBottom: 8,
                                  paddingLeft: 10, paddingRight: 10,
                                  borderRadius: 6,
                                  backgroundColor: isSelected ? 'theme:bg1' : 'transparent',
                                  borderWidth: 1, borderColor: isSelected ? 'theme:accent' : 'transparent',
                                }}>
                                  <Box style={{ width: 14, alignItems: 'center' }}>
                                    {isSelected && <Icon icon={Check} size={12} color="theme:accent" strokeWidth={2} />}
                                  </Box>
                                  {optConn?.iconId && PROVIDER_ICONS[optConn.iconId] ? (
                                    <ProviderIcon providerId={optConn.iconId} size={20} />
                                  ) : (
                                    <Box style={{ width: 20, height: 20 }} />
                                  )}
                                  <Box style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'column', gap: 2 }}>
                                    <S.Body noWrap>{modelLabel(opt)}</S.Body>
                                    <S.Caption noWrap>{optConn?.label || opt.connectionId}</S.Caption>
                                  </Box>
                                </Box>
                              </Pressable>
                            );
                          })}
                        </Box>
                      </ScrollView>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </S.Card>
    </Section>
  );
}
