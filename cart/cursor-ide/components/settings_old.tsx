const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import { FadeIn } from '../anim';
import { getProviderIconInfo, getModelIconInfo } from '../model-icons';
import type { ProviderConfig, ModelConfig } from '../providers';
import type { AnyVariable, AppLevelVariable, WildcardVariable } from '../variables';
import { SYSTEM_VARIABLES, createAppVariable, createWildcardVariable, deleteVariable, listCustomVariables, saveVariable } from '../variables';
import type { ProxyConfig } from '../proxy';
import { createProxyConfig, deleteProxyConfig, getActiveProxyConfig, loadProxyConfig, saveProxyConfig, setProxyActive, validateProxyConfig } from '../proxy';
import type { DefaultModelsSettings, ModelReference } from '../default-models';
import { updateImageGenModel, updateResearchOrchestrator, updateResearchReader, updateRunnerConfig, updateShadowModel, updateTextModel, updateVisionProxy } from '../default-models';
import { ApiKeyPanel } from './apikeypanel';
import { IndexerPanel } from './indexerpanel';
import { DiffPanel } from './diffpanel';
import { loadCheckpoints } from '../checkpoint';

// ── Icon Badge (colored initials substitute for PNG icons) ───────────────────

function IconBadge(props: { providerId: string; size?: number }) {
  const info = getProviderIconInfo(props.providerId);
  const size = props.size || 20;
  return (
    <Box style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: info.color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 16;
  return (
    <Box style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: info.color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

// ── Settings Row (sidebar item) ──────────────────────────────────────────────

export function SettingsRow(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={() => props.onSelect(props.section.id)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? props.section.tone : COLORS.border,
        backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
        gap: 4,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Glyph icon={props.section.icon === 'globe' ? 'globe' : props.section.icon === 'folder' ? 'folder' : props.section.icon === 'bot' ? 'bot' : props.section.icon === 'sparkles' ? 'sparkles' : props.section.icon === 'braces' ? 'braces' : props.section.icon === 'network' ? 'globe' : props.section.icon === 'command' ? 'command' : 'palette'} tone={props.section.tone} backgroundColor="transparent" tiny={true} />
        <Text fontSize={12} color={active ? COLORS.textBright : COLORS.text} style={{ fontWeight: 'bold' }}>{props.section.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} color={props.section.tone}>{props.section.count}</Text>
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{props.section.meta}</Text>
    </Pressable>
  );
}

// ── Info Card (legacy) ───────────────────────────────────────────────────────

export function InfoCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.owner || item.backend || item.runtime || item.status} color={item.tone} tiny={true} />
        {item.scope ? <Pill label={item.scope} color={COLORS.blue} tiny={true} /> : null}
        {item.retention ? <Pill label={item.retention} color={COLORS.purple} tiny={true} /> : null}
      </Row>
      {item.source ? <Text fontSize={10} color={COLORS.textDim}>{item.source}</Text> : null}
      {item.summary ? <Text fontSize={11} color={COLORS.text}>{item.summary}</Text> : null}
      {item.stress ? <Text fontSize={10} color={COLORS.orange}>stress: {item.stress}</Text> : null}
      {item.output ? <Text fontSize={10} color={COLORS.blue}>output: {item.output}</Text> : null}
      {item.risk ? <Text fontSize={10} color={COLORS.red}>risk: {item.risk}</Text> : null}
    </Box>
  );
}

export function CapabilityCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.status} color={item.tone} borderColor={item.tone} backgroundColor={COLORS.panelBg} tiny={true} />
        <Pill label={item.surface} tiny={true} />
      </Row>
      <Text fontSize={11} color={COLORS.text}>{item.summary}</Text>
      <Text fontSize={10} color={COLORS.blue}>reference: {item.reference}</Text>
      <Text fontSize={10} color={COLORS.orange}>pressure: {item.pressure}</Text>
    </Box>
  );
}

// ── Provider Card (new, with icons) ──────────────────────────────────────────

export function ProviderCardNew(props: { provider: ProviderConfig; active: boolean; onSelect: (id: string) => void; onToggleEnabled: (id: string) => void }) {
  const p = props.provider;
  const icon = getProviderIconInfo(p.type);
  return (
    <Row style={{ gap: 8, alignItems: 'stretch' }}>
      <Pressable
        onPress={() => props.onSelect(p.type)}
        style={{
          flexGrow: 1,
          flexBasis: 0,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: props.active ? icon.color : COLORS.border,
          backgroundColor: props.active ? COLORS.panelHover : COLORS.panelRaised,
          gap: 8,
        }}
      >
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <IconBadge providerId={p.type} />
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{icon.name}</Text>
            <Text fontSize={10} color={COLORS.textDim}>{p.baseUrl || 'embedded runtime'}</Text>
          </Col>
          <Pill label={p.enabled ? 'enabled' : 'disabled'} color={p.enabled ? COLORS.green : COLORS.textMuted} tiny={true} />
        </Row>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <Pill label={p.models.length + ' models'} tiny={true} />
          <Pill label={p.defaultModel} color={COLORS.blue} tiny={true} />
        </Row>
      </Pressable>
      <Pressable
        onPress={() => props.onToggleEnabled(p.type)}
        style={{
          width: 104,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: p.enabled ? COLORS.green : COLORS.border,
          backgroundColor: p.enabled ? COLORS.greenDeep : COLORS.panelRaised,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={10} color={p.enabled ? COLORS.green : COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {p.enabled ? 'Enabled' : 'Disabled'}
        </Text>
      </Pressable>
    </Row>
  );
}

// ── Model Row ────────────────────────────────────────────────────────────────

function ModelRow(props: { model: ModelConfig; selected: boolean; onSelect: () => void }) {
  const m = props.model;
  const icon = getModelIconInfo(m.id);
  return (
    <Pressable
      onPress={props.onSelect}
      style={{
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: props.selected ? icon.color : COLORS.border,
        backgroundColor: props.selected ? '#1a1f2e' : COLORS.panelBg,
        gap: 6,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <ModelIconBadge modelId={m.id} />
        <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{m.displayName}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{m.id}</Text>
        </Col>
        {m.supportsVision ? <Pill label="vision" color={COLORS.purple} tiny={true} /> : null}
        {m.supportsTools ? <Pill label="tools" color={COLORS.green} tiny={true} /> : null}
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={COLORS.textDim}>ctx: {(m.contextWindow / 1000).toFixed(0)}k</Text>
        <Text fontSize={9} color={COLORS.textDim}>out: {(m.maxOutput / 1000).toFixed(0)}k</Text>
        <Text fontSize={9} color={COLORS.textDim}>${m.inputPrice}/${m.outputPrice}</Text>
      </Row>
    </Pressable>
  );
}

// ── Model Selector Dropdown ──────────────────────────────────────────────────

function ModelSelector(props: {
  value: ModelReference;
  onChange: (ref: ModelReference) => void;
  providers: ProviderConfig[];
  label?: string;
  description?: string;
  filterVision?: boolean;
  allowDisabledProviders?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedProvider = props.providers.find(p => p.type === props.value.provider);
  const selectedModel = selectedProvider?.models.find(m => m.id === props.value.modelId);
  const icon = selectedModel ? getModelIconInfo(selectedModel.id) : getProviderIconInfo(props.value.provider);

  return (
    <Col style={{ gap: 6, position: 'relative', zIndex: open ? 9999 : 0, overflow: 'visible' }}>
      {props.label ? <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text> : null}
      {props.description ? <Text fontSize={10} color={COLORS.textDim}>{props.description}</Text> : null}
      <Box style={{ position: 'relative', zIndex: open ? 9999 : 0, overflow: 'visible' }}>
        <Pressable onPress={() => setOpen(!open)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 8 }}>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Box style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: icon.color, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={7} color="#000" style={{ fontWeight: 'bold' }}>{icon.initial}</Text>
            </Box>
            <Text fontSize={11} color={COLORS.text}>{selectedModel?.displayName || props.value.modelId}</Text>
            <Box style={{ flexGrow: 1 }} />
            <Text fontSize={10} color={COLORS.textDim}>{open ? '▲' : '▼'}</Text>
          </Row>
        </Pressable>
        {open ? (
          <Col style={{ position: 'absolute', left: 0, right: 0, top: 46, gap: 6, maxHeight: 280, overflow: 'scroll', zIndex: 10000 }}>
            {props.providers.filter(p => (p.enabled || props.allowDisabledProviders) && p.models.length > 0).map(provider => (
              <Col key={provider.type} style={{ gap: 4 }}>
                <Row style={{ alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                  <IconBadge providerId={provider.type} size={14} />
                  <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>{getProviderIconInfo(provider.type).name}</Text>
                </Row>
                {provider.models
                  .filter(m => !props.filterVision || m.supportsVision)
                  .map(model => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      selected={props.value.provider === provider.type && props.value.modelId === model.id}
                      onSelect={() => { props.onChange({ provider: provider.type, modelId: model.id }); setOpen(false); }}
                    />
                  ))}
              </Col>
            ))}
          </Col>
        ) : null}
      </Box>
    </Col>
  );
}

// ── Default Models Panel ─────────────────────────────────────────────────────

function DefaultModelsPanel(props: {
  settings: DefaultModelsSettings;
  providers: ProviderConfig[];
  onUpdate: (s: DefaultModelsSettings) => void;
}) {
  const s = props.settings;
  const p = props.providers;
  const uniformRunnerModel = s.research.runners.uniformModel || s.textModel;
  const individualRunnerModels = s.research.runners.individualModels && s.research.runners.individualModels.length > 0
    ? s.research.runners.individualModels
    : Array.from({ length: s.research.runners.count }, () => uniformRunnerModel);

  function updateRunnerCount(nextCount: number) {
    const count = Math.max(1, Math.min(10, nextCount));
    const nextIndividual = individualRunnerModels.slice(0, count);
    while (nextIndividual.length < count) nextIndividual.push(uniformRunnerModel);
    props.onUpdate(updateRunnerConfig(s, { count, individualModels: nextIndividual }));
  }

  function updateRunnerMode(mode: 'uniform' | 'individual') {
    const next = mode === 'uniform'
      ? updateRunnerConfig(s, { mode, individualModels: [] })
      : updateRunnerConfig(s, { mode, individualModels: individualRunnerModels.slice(0, s.research.runners.count) });
    props.onUpdate(next);
  }

  function updateRunnerModelAt(index: number, ref: ModelReference) {
    const next = individualRunnerModels.slice(0, s.research.runners.count);
    while (next.length < s.research.runners.count) next.push(uniformRunnerModel);
    next[index] = ref;
    props.onUpdate(updateRunnerConfig(s, { individualModels: next, mode: 'individual' }));
  }

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Default Models</Text>
        <Text fontSize={10} color={COLORS.textDim}>Configure which AI models are used across the application.</Text>

        <ModelSelector
          label="Text Model"
          description="Primary model for chat conversations"
          value={s.textModel}
          onChange={(ref) => props.onUpdate(updateTextModel(s, ref))}
          providers={p}
        />

        <Col style={{ gap: 6 }}>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Vision Proxy</Text>
            <Pressable onPress={() => props.onUpdate({ ...s, visionProxy: { ...s.visionProxy, enabled: !s.visionProxy.enabled } })}>
              <Pill label={s.visionProxy.enabled ? 'ON' : 'OFF'} color={s.visionProxy.enabled ? COLORS.green : COLORS.textMuted} tiny={true} />
            </Pressable>
          </Row>
          {s.visionProxy.enabled ? (
            <ModelSelector
              description="Model used for image description when primary lacks vision"
              value={{ provider: s.visionProxy.provider, modelId: s.visionProxy.modelId }}
              onChange={(ref) => props.onUpdate(updateVisionProxy(s, { provider: ref.provider, modelId: ref.modelId }))}
              providers={p}
              filterVision={true}
            />
          ) : null}
        </Col>

        <ModelSelector
          label="Shadow Model"
          description="Background tasks: titles, summaries, TTS scripts"
          value={s.shadowModel}
          onChange={(ref) => props.onUpdate(updateShadowModel(s, ref))}
          providers={p}
        />

        <Col style={{ gap: 8 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Image Generation</Text>
          <Text fontSize={10} color={COLORS.textDim}>Freeform model id, because image generation is not tied to the text provider list here yet.</Text>
          <TextInput value={s.imageGen.modelId} onChangeText={(value: string) => props.onUpdate(updateImageGenModel(s, value))} style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, backgroundColor: COLORS.panelBg }} />
        </Col>
      </Box>

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Deep Research</Text>
        <ModelSelector
          label="Orchestrator"
          description="Coordinates research sessions"
          value={s.research.orchestrator}
          onChange={(ref) => props.onUpdate(updateResearchOrchestrator(s, ref))}
          providers={p}
        />
        <ModelSelector
          label="Reader"
          description="Extracts content from discovered sources"
          value={s.research.reader}
          onChange={(ref) => props.onUpdate(updateResearchReader(s, ref))}
          providers={p}
        />
        <Col style={{ gap: 6 }}>
          <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Runners</Text>
            <Pressable onPress={() => updateRunnerMode('uniform')}>
              <Pill label={s.research.runners.mode === 'uniform' ? 'uniform' : 'Uniform'} color={s.research.runners.mode === 'uniform' ? COLORS.green : COLORS.textDim} tiny={true} />
            </Pressable>
            <Pressable onPress={() => updateRunnerMode('individual')}>
              <Pill label={s.research.runners.mode === 'individual' ? 'individual' : 'Individual'} color={s.research.runners.mode === 'individual' ? COLORS.green : COLORS.textDim} tiny={true} />
            </Pressable>
          </Row>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Text fontSize={10} color={COLORS.textDim}>Count:</Text>
            <Pressable onPress={() => updateRunnerCount(s.research.runners.count - 1)}>
              <Text fontSize={12} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
            </Pressable>
            <Text fontSize={11} color={COLORS.text}>{s.research.runners.count}</Text>
            <Pressable onPress={() => updateRunnerCount(s.research.runners.count + 1)}>
              <Text fontSize={12} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
            </Pressable>
          </Row>
          {s.research.runners.mode === 'uniform' ? (
            <ModelSelector
              label="Runner Model"
              description="Used for all research runners when mode is uniform"
              value={s.research.runners.uniformModel || uniformRunnerModel}
              onChange={(ref) => props.onUpdate(updateRunnerConfig(s, { uniformModel: ref, individualModels: [] }))}
              providers={p}
            />
          ) : (
            <Col style={{ gap: 8 }}>
              <Text fontSize={10} color={COLORS.textDim}>Each runner can use a different model.</Text>
              {individualRunnerModels.slice(0, s.research.runners.count).map((ref, idx) => (
                <ModelSelector
                  key={'runner_' + idx}
                  label={'Runner ' + (idx + 1)}
                  value={ref}
                  onChange={(next) => updateRunnerModelAt(idx, next)}
                  providers={p}
                />
              ))}
            </Col>
          )}
        </Col>
      </Box>
    </Col>
  );
}

// ── Variables Panel ──────────────────────────────────────────────────────────

function VariablesPanel(props: { onChange?: () => void }) {
  const [customVars, setCustomVars] = useState<AnyVariable[]>(listCustomVariables());
  const [showCreate, setShowCreate] = useState<'app' | 'wildcard' | null>(null);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newOptions, setNewOptions] = useState('');

  function refresh() {
    setCustomVars(listCustomVariables());
    props.onChange?.();
  }

  function doCreateApp() {
    if (!newName.trim()) return;
    createAppVariable(newName.trim(), newValue, 'App-level variable');
    setNewName(''); setNewValue(''); setShowCreate(null);
    refresh();
  }

  function doCreateWildcard() {
    if (!newName.trim()) return;
    const opts = newOptions.split('\n').map(s => s.trim()).filter(Boolean);
    if (opts.length === 0) return;
    createWildcardVariable(newName.trim(), opts, false, 'Wildcard variable');
    setNewName(''); setNewOptions(''); setShowCreate(null);
    refresh();
  }

  function doDelete(name: string) {
    deleteVariable(name);
    refresh();
  }

  function doToggleEnabled(v: AnyVariable) {
    saveVariable({ ...v, isEnabled: !v.isEnabled } as AnyVariable);
    refresh();
  }

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>System Variables</Text>
        <Text fontSize={10} color={COLORS.textDim}>Built-in, always available. Use as {'{{name}'} in chat.</Text>
        <Col style={{ gap: 6 }}>
          {SYSTEM_VARIABLES.map(v => (
            <Row key={v.id} style={{ alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: COLORS.panelBg }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{'{{' + v.name + '}'}</Text>
              <Text fontSize={10} color={COLORS.textDim}>{v.description}</Text>
            </Row>
          ))}
        </Col>
      </Box>

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Custom Variables</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={() => setShowCreate(showCreate === 'app' ? null : 'app')}>
            <Pill label="+ App" color={COLORS.blue} tiny={true} />
          </Pressable>
          <Pressable onPress={() => setShowCreate(showCreate === 'wildcard' ? null : 'wildcard')}>
            <Pill label="+ Wildcard" color={COLORS.purple} tiny={true} />
          </Pressable>
        </Row>

        {showCreate === 'app' ? (
          <Col style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={10} color={COLORS.textDim}>Name (used as {'{{name}'})</Text>
            <TextInput value={newName} onChangeText={setNewName} style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <Text fontSize={10} color={COLORS.textDim}>Value</Text>
            <TextInput value={newValue} onChangeText={setNewValue} style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <Pressable onPress={doCreateApp} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Create</Text>
            </Pressable>
          </Col>
        ) : null}

        {showCreate === 'wildcard' ? (
          <Col style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={10} color={COLORS.textDim}>Name (used as {'{{name}'})</Text>
            <TextInput value={newName} onChangeText={setNewName} style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <Text fontSize={10} color={COLORS.textDim}>Options (one per line, random pick)</Text>
            <TextInput value={newOptions} onChangeText={setNewOptions} style={{ height: 80, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} multiline={true} />
            <Pressable onPress={doCreateWildcard} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Create</Text>
            </Pressable>
          </Col>
        ) : null}

        <Col style={{ gap: 6 }}>
          {customVars.length === 0 ? <Text fontSize={10} color={COLORS.textDim}>No custom variables yet.</Text> : null}
          {customVars.map(v => (
            <Row key={v.id} style={{ alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: COLORS.panelBg }}>
              <Pressable onPress={() => doToggleEnabled(v)}>
                <Pill label={v.isEnabled ? 'on' : 'off'} color={v.isEnabled ? COLORS.green : COLORS.textMuted} tiny={true} />
              </Pressable>
              <Text fontSize={11} color={v.isEnabled ? COLORS.blue : COLORS.textMuted} style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{'{{' + v.name + '}'}</Text>
              <Pill label={v.type} color={v.type === 'wildcard' ? COLORS.purple : COLORS.green} tiny={true} />
              <Text fontSize={10} color={COLORS.textDim}>{v.type === 'app-level' ? (v as AppLevelVariable).value.slice(0, 40) : (v as WildcardVariable).options.length + ' options'}</Text>
              <Box style={{ flexGrow: 1 }} />
              <Pressable onPress={() => doToggleEnabled(v)}><Text fontSize={10} color={COLORS.textDim}>Toggle</Text></Pressable>
              <Pressable onPress={() => doDelete(v.name)}><Text fontSize={10} color={COLORS.red}>Delete</Text></Pressable>
            </Row>
          ))}
        </Col>
      </Box>
    </Col>
  );
}

// ── Proxy Panel ──────────────────────────────────────────────────────────────

function ProxyPanel(props: { configs: ProxyConfig[]; status: any; onChange: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [nickname, setNickname] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState<'http' | 'socks5'>('http');

  function doCreate() {
    const p = parseInt(port, 10);
    if (!nickname.trim() || !hostname.trim() || isNaN(p)) return;
    const config = createProxyConfig({ nickname: nickname.trim(), type, hostname: hostname.trim(), port: p, username: username.trim() || undefined, password: password.trim() || undefined });
    const err = validateProxyConfig(config);
    if (err) return;
    saveProxyConfig(config);
    setNickname(''); setHostname(''); setPort(''); setUsername(''); setPassword(''); setShowCreate(false);
    props.onChange();
  }

  function doDelete(id: string) {
    deleteProxyConfig(id);
    props.onChange();
  }

  function doToggle(id: string) {
    const config = loadProxyConfig(id);
    if (config) {
      if (config.isActive) {
        setProxyActive(null);
      } else {
        setProxyActive(id);
      }
      props.onChange();
    }
  }

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Proxy Configuration</Text>
        <Text fontSize={10} color={COLORS.textDim}>HTTP/SOCKS5 proxy for API requests. (Host-level routing required.)</Text>

        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Text fontSize={11} color={COLORS.textBright}>Status:</Text>
          <Pill label={props.status.isEnabled ? 'Active' : 'Inactive'} color={props.status.isEnabled ? COLORS.green : COLORS.textMuted} tiny={true} />
          {props.status.activeConfig ? <Text fontSize={10} color={COLORS.textDim}>{props.status.activeConfig.nickname}</Text> : null}
        </Row>

        <Pressable onPress={() => setShowCreate(!showCreate)}>
          <Pill label={showCreate ? 'Cancel' : '+ Add Proxy'} color={COLORS.blue} tiny={true} />
        </Pressable>

        {showCreate ? (
          <Col style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.panelBg }}>
            <TextInput value={nickname} onChangeText={setNickname} placeholder="Nickname" style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <Row style={{ gap: 8 }}>
              <Pressable onPress={() => setType('http')} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: type === 'http' ? COLORS.blue : COLORS.border, backgroundColor: type === 'http' ? COLORS.blueDeep : COLORS.panelRaised }}>
                <Text fontSize={10} color={type === 'http' ? COLORS.blue : COLORS.text}>HTTP</Text>
              </Pressable>
              <Pressable onPress={() => setType('socks5')} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: type === 'socks5' ? COLORS.blue : COLORS.border, backgroundColor: type === 'socks5' ? COLORS.blueDeep : COLORS.panelRaised }}>
                <Text fontSize={10} color={type === 'socks5' ? COLORS.blue : COLORS.text}>SOCKS5</Text>
              </Pressable>
            </Row>
            <TextInput value={hostname} onChangeText={setHostname} placeholder="Hostname" style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <TextInput value={port} onChangeText={setPort} placeholder="Port" style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <TextInput value={username} onChangeText={setUsername} placeholder="Username (optional)" style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password (optional)" style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8 }} />
            <Pressable onPress={doCreate} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Save</Text>
            </Pressable>
          </Col>
        ) : null}

        <Col style={{ gap: 6 }}>
          {props.configs.length === 0 ? <Text fontSize={10} color={COLORS.textDim}>No proxy configs saved.</Text> : null}
          {props.configs.map(cfg => (
            <Row key={cfg.id} style={{ alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: COLORS.panelBg }}>
              <Pressable onPress={() => doToggle(cfg.id)}>
                <Pill label={cfg.isActive ? '●' : '○'} color={cfg.isActive ? COLORS.green : COLORS.textMuted} tiny={true} />
              </Pressable>
              <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{cfg.nickname}</Text>
                <Text fontSize={9} color={COLORS.textDim}>{cfg.type}://{cfg.hostname}:{cfg.port}</Text>
                {cfg.username ? <Text fontSize={9} color={COLORS.textDim}>{'user: ' + cfg.username}</Text> : null}
              </Col>
              <Pressable onPress={() => doDelete(cfg.id)}><Text fontSize={10} color={COLORS.red}>Delete</Text></Pressable>
            </Row>
          ))}
        </Col>
      </Box>
    </Col>
  );
}

// ── Settings Surface ─────────────────────────────────────────────────────────

export function SettingsSurface(props: any) {
  const stacked = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const selectedProvider = (props.providerConfigs || []).find((provider: any) => provider.type === props.selectedProviderId) || (props.providerConfigs || [])[0];

  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: stacked ? 12 : 18, gap: 16 }}>
        <Box style={{ padding: stacked ? 14 : 18, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>SETTINGS SURFACE</Text>
          <FadeIn delay={60}>
            <Text fontSize={stacked ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              Provider routing, context layers, memory, and plugin runtimes
            </Text>
          </FadeIn>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label="model" color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.selectedModelName} color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.workspaceName} color={COLORS.blue} />
            <Pill label={props.gitBranch} color={COLORS.green} />
            <Pill label={props.agentStatusText} color={COLORS.purple} />
          </Row>
        </Box>

        <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
          <Col style={{ width: stacked ? '100%' : 240, gap: 10 }}>
            {props.sections.map((section: any) => (
              <SettingsRow key={section.id} section={section} active={section.id === props.activeSection ? 1 : 0} onSelect={props.onSelectSection} />
            ))}
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 14 }}>
            {props.activeSection === 'providers' ? (
              <Col style={{ gap: 14 }}>
                <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
                  <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Model Providers</Text>
                  <Text fontSize={10} color={COLORS.textDim}>Select a provider to view and configure its models. Disabled providers stay visible so routing changes are reversible.</Text>
                  <Col style={{ gap: 10 }}>
                    {props.providerConfigs.map((provider: ProviderConfig) => (
                      <ProviderCardNew
                        key={provider.type}
                        provider={provider}
                        active={provider.type === props.selectedProviderId}
                        onSelect={props.onSelectProvider}
                        onToggleEnabled={props.onToggleProvider}
                      />
                    ))}
                  </Col>
                </Box>
                {selectedProvider ? (
                  <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: getProviderIconInfo(selectedProvider.type).color || COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12, overflow: 'visible' }}>
                    <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{getProviderIconInfo(selectedProvider.type).name} Models</Text>
                      <Pressable onPress={() => props.onToggleProvider(selectedProvider.type)}>
                        <Pill label={selectedProvider.enabled ? 'enabled' : 'disabled'} color={selectedProvider.enabled ? COLORS.green : COLORS.textMuted} tiny={true} />
                      </Pressable>
                    </Row>
                    <Row style={{ gap: 10, flexWrap: 'wrap', overflow: 'visible' }}>
                      <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
                        <Text fontSize={10} color={COLORS.textDim}>Base URL</Text>
                        <TextInput
                          value={selectedProvider.baseUrl || ''}
                          onChangeText={(value: string) => props.onUpdateProvider(selectedProvider.type, { baseUrl: value })}
                          style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, backgroundColor: COLORS.panelBg }}
                        />
                      </Col>
                      <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
                        <ModelSelector
                          label="Default Model"
                          description="Provider default model used when a task does not specify one"
                          value={{ provider: selectedProvider.type, modelId: selectedProvider.defaultModel }}
                          onChange={(ref) => props.onUpdateProvider(selectedProvider.type, { defaultModel: ref.modelId })}
                          providers={[selectedProvider]}
                          allowDisabledProviders={true}
                        />
                      </Col>
                    </Row>
                    <Col style={{ gap: 8, overflow: 'visible' }}>
                      {(selectedProvider.models || []).map((model: ModelConfig) => (
                        <ModelRow
                          key={model.id}
                          model={model}
                          selected={props.selectedModel === model.id}
                          onSelect={() => props.onSelectModel(model.id, model.displayName, selectedProvider.type)}
                        />
                      ))}
                    </Col>
                  </Box>
                ) : null}
              </Col>
            ) : null}

            {props.activeSection === 'defaults' ? (
              <DefaultModelsPanel
                settings={props.defaultModels}
                providers={props.providerConfigs}
                onUpdate={props.onUpdateDefaultModels}
              />
            ) : null}

            {props.activeSection === 'variables' ? (
              <VariablesPanel onChange={props.onVariablesChange} />
            ) : null}

            {props.activeSection === 'proxy' ? (
              <ProxyPanel configs={props.proxyConfigs} status={props.proxyStatus} onChange={props.onProxyChange} />
            ) : null}

            {props.activeSection === 'keys' ? (
              <ApiKeyPanel onChange={props.onKeysChange} />
            ) : null}

            {props.activeSection === 'index' ? (
              <IndexerPanel workDir={props.workDir} onIndex={props.onIndexChange} />
            ) : null}

            {props.activeSection === 'checkpoints' ? (
              <DiffPanel checkpoints={props.checkpoints || []} onSelectCheckpoint={props.onSelectCheckpoint} onClose={() => props.onSelectSection('providers')} />
            ) : null}

            {props.activeSection === 'context' ? <Col style={{ gap: 10 }}>{props.contextRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'memory' ? <Col style={{ gap: 10 }}>{props.memoryRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'plugins' ? <Col style={{ gap: 10 }}>{props.pluginRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'automations' ? <Col style={{ gap: 10 }}>{props.automationRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'capabilities' ? <Col style={{ gap: 10 }}>{props.capabilityRows.map((item: any) => <CapabilityCard key={item.name} item={item} />)}</Col> : null}
          </Col>
        </Box>
      </Col>
    </ScrollView>
  );
}
