const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../theme';
import { THEME_ORDER, THEMES } from '../themes';
import { Glyph, Pill } from './shared';
import { FadeIn } from '../anim';
import { getProviderIconInfo, getModelIconInfo } from '../model-icons';
import type { ProviderConfig, ModelConfig } from '../providers';
import type { ModelReference } from '../default-models';

// =============================================================================
// SETTINGS — 8-section surface: Appearance, Editor, Terminal, Keybindings,
// Providers, Memory, Plugins, About. Real controls that map to state and
// persist via __store_get / __store_set host bindings.
// =============================================================================

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const storeDel = typeof host.__store_del === 'function' ? host.__store_del : (_: string) => {};

const KEY = 'cursor-ide.settings';

function sget<T>(path: string, fallback: T): T {
  try {
    const raw = storeGet(KEY + '.' + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'boolean') return (raw === 'true' || raw === '1') as any;
    if (typeof fallback === 'number') { const n = Number(raw); return (isNaN(n) ? fallback : n) as any; }
    if (typeof fallback === 'object' && fallback !== null) { try { return JSON.parse(String(raw)); } catch { return fallback; } }
    return String(raw) as any;
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try {
    const enc = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
    storeSet(KEY + '.' + path, enc);
  } catch {}
}
function sdel(path: string) { try { storeDel(KEY + '.' + path); } catch {} }

// ── Section Definitions ──────────────────────────────────────────────────────

type SectionId = 'appearance' | 'editor' | 'terminal' | 'keybindings' | 'providers' | 'memory' | 'plugins' | 'about';

interface SectionDef {
  id: SectionId;
  label: string;
  description: string;
  icon: string;
  tone: string;
}

function sectionList(): SectionDef[] {
  return [
    { id: 'appearance',  label: 'Appearance',  description: 'Theme, density, font scale',           icon: 'palette',  tone: COLORS.purple },
    { id: 'editor',      label: 'Editor',      description: 'Font size, tabs, wrap, line numbers',  icon: 'braces',   tone: COLORS.blue   },
    { id: 'terminal',    label: 'Terminal',    description: 'Shell, font, cursor, scrollback',      icon: 'command',  tone: COLORS.green  },
    { id: 'keybindings', label: 'Keybindings', description: 'Shortcuts and command palette',        icon: 'command',  tone: COLORS.orange },
    { id: 'providers',   label: 'Providers',   description: 'Models, API keys, default routing',    icon: 'globe',    tone: COLORS.blue   },
    { id: 'memory',      label: 'Memory',      description: 'Variables, checkpoints, context',      icon: 'bot',      tone: COLORS.purple },
    { id: 'plugins',     label: 'Plugins',     description: 'Installed plugins, enable / disable',  icon: 'sparkles', tone: COLORS.orange },
    { id: 'about',       label: 'About',       description: 'Version, build, capabilities',         icon: 'folder',   tone: COLORS.yellow },
  ];
}

const LEGACY_SECTION_MAP: Record<string, SectionId> = {
  providers: 'providers',
  defaults: 'providers',
  variables: 'memory',
  proxy: 'providers',
  context: 'memory',
  memory: 'memory',
  plugins: 'plugins',
  automations: 'plugins',
  capabilities: 'about',
  checkpoints: 'memory',
};

// ── Shared UI primitives ─────────────────────────────────────────────────────

function SectionTitle(props: { title: string; description?: string; onReset?: () => void }) {
  return (
    <Row style={{ alignItems: 'flex-start', gap: 12 }}>
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 4 }}>
        <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>{props.title.toUpperCase()}</Text>
        <Text fontSize={18} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
        {props.description ? <Text fontSize={11} color={COLORS.textDim}>{props.description}</Text> : null}
      </Col>
      {props.onReset ? (
        <Pressable onPress={props.onReset} style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
          borderRadius: TOKENS.radiusMd, borderWidth: 1,
          borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Reset section</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

function SettingRow(props: { title: string; description?: string; highlight?: boolean; children?: any }) {
  return (
    <Row style={{
      padding: 12, gap: 14,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.highlight ? COLORS.blue : COLORS.border,
      backgroundColor: props.highlight ? COLORS.panelHover : COLORS.panelRaised,
      alignItems: 'center', flexWrap: 'wrap',
    }}>
      <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 180, gap: 3 }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
        {props.description ? <Text fontSize={10} color={COLORS.textDim}>{props.description}</Text> : null}
      </Col>
      <Box style={{ flexShrink: 0 }}>{props.children}</Box>
    </Row>
  );
}

function Toggle(props: { value: boolean; onChange: (v: boolean) => void; onLabel?: string; offLabel?: string }) {
  const on = !!props.value;
  return (
    <Pressable onPress={() => props.onChange(!on)} style={{
      paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
      borderRadius: TOKENS.radiusPill, borderWidth: 1,
      borderColor: on ? COLORS.green : COLORS.border,
      backgroundColor: on ? COLORS.greenDeep : COLORS.panelAlt,
    }}>
      <Text fontSize={10} color={on ? COLORS.green : COLORS.textDim} style={{ fontWeight: 'bold' }}>
        {on ? (props.onLabel || 'ON') : (props.offLabel || 'OFF')}
      </Text>
    </Pressable>
  );
}

function Stepper(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const step = props.step || 1;
  const min = typeof props.min === 'number' ? props.min : -Infinity;
  const max = typeof props.max === 'number' ? props.max : Infinity;
  function clamp(n: number) { return Math.max(min, Math.min(max, n)); }
  return (
    <Row style={{ alignItems: 'center', gap: 6 }}>
      <Pressable onPress={() => props.onChange(clamp(props.value - step))} style={{ width: 28, height: 28, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={14} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
      </Pressable>
      <Box style={{ minWidth: 52, padding: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, alignItems: 'center' }}>
        <Text fontSize={12} color={COLORS.textBright}>{String(props.value) + (props.suffix || '')}</Text>
      </Box>
      <Pressable onPress={() => props.onChange(clamp(props.value + step))} style={{ width: 28, height: 28, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={14} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
      </Pressable>
    </Row>
  );
}

function PillSelect(props: { value: string; options: Array<{ value: string; label: string; color?: string }>; onChange: (v: string) => void }) {
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {props.options.map(opt => {
        const active = opt.value === props.value;
        const color = opt.color || COLORS.blue;
        return (
          <Pressable key={opt.value} onPress={() => props.onChange(opt.value)} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
            borderRadius: TOKENS.radiusMd, borderWidth: 1,
            borderColor: active ? color : COLORS.border,
            backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
          }}>
            <Text fontSize={10} color={active ? color : COLORS.textDim} style={{ fontWeight: 'bold' }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

function TextField(props: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string; mono?: boolean }) {
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      style={{
        height: 32, width: props.width || 220,
        borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
        paddingLeft: 10, paddingRight: 10,
        backgroundColor: COLORS.panelBg,
        fontFamily: props.mono ? 'monospace' : undefined,
      }}
    />
  );
}

// ── Provider-scope primitives (kept, z-index fix preserved) ──────────────────

function IconBadge(props: { providerId: string; size?: number }) {
  const info = getProviderIconInfo(props.providerId);
  const size = props.size || 20;
  return (
    <Box style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: info.color, justifyContent: 'center', alignItems: 'center' }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 16;
  return (
    <Box style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: info.color, justifyContent: 'center', alignItems: 'center' }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

function ModelRow(props: { model: ModelConfig; selected: boolean; onSelect: () => void }) {
  const m = props.model;
  const icon = getModelIconInfo(m.id);
  return (
    <Pressable onPress={props.onSelect} style={{
      padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.selected ? icon.color : COLORS.border,
      backgroundColor: props.selected ? '#1a1f2e' : COLORS.panelBg,
      gap: 6,
    }}>
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

function ProviderCardCompact(props: { provider: ProviderConfig; active: boolean; onSelect: (id: string) => void; onToggleEnabled: (id: string) => void }) {
  const p = props.provider;
  const icon = getProviderIconInfo(p.type);
  return (
    <Row style={{ gap: 8, alignItems: 'stretch' }}>
      <Pressable onPress={() => props.onSelect(p.type)} style={{
        flexGrow: 1, flexBasis: 0, padding: 12, borderRadius: TOKENS.radiusMd,
        borderWidth: 1, borderColor: props.active ? icon.color : COLORS.border,
        backgroundColor: props.active ? COLORS.panelHover : COLORS.panelRaised, gap: 8,
      }}>
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
      <Pressable onPress={() => props.onToggleEnabled(p.type)} style={{
        width: 92, padding: 12, borderRadius: TOKENS.radiusMd,
        borderWidth: 1, borderColor: p.enabled ? COLORS.green : COLORS.border,
        backgroundColor: p.enabled ? COLORS.greenDeep : COLORS.panelRaised,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text fontSize={10} color={p.enabled ? COLORS.green : COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {p.enabled ? 'Enabled' : 'Disabled'}
        </Text>
      </Pressable>
    </Row>
  );
}

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
        <Pressable onPress={() => setOpen(!open)} style={{ padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 8 }}>
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
                {provider.models.filter(m => !props.filterVision || m.supportsVision).map(model => (
                  <ModelRow key={model.id} model={model}
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

// ── Theme swatch (from Worker 9's theme panel) ───────────────────────────────

function ThemeSwatch(props: { name: string; active: boolean; onPress: () => void }) {
  const theme = THEMES[props.name];
  const p = theme.palette;
  const t = theme.tokens;
  return (
    <Pressable onPress={props.onPress}>
      <Col style={{
        padding: 10, gap: 8,
        borderRadius: t.radiusMd,
        borderWidth: props.active ? 2 : 1,
        borderColor: props.active ? p.blue : COLORS.border,
        backgroundColor: COLORS.panelRaised,
        minWidth: 140,
      }}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 10, height: 10, borderRadius: t.radiusSm, backgroundColor: p.appBg, borderWidth: 1, borderColor: p.border }} />
          <Box style={{ width: 10, height: 10, borderRadius: t.radiusSm, backgroundColor: p.panelRaised, borderWidth: 1, borderColor: p.border }} />
          <Box style={{ width: 10, height: 10, borderRadius: t.radiusSm, backgroundColor: p.blue }} />
          <Box style={{ width: 10, height: 10, borderRadius: t.radiusSm, backgroundColor: p.green }} />
          <Box style={{ width: 10, height: 10, borderRadius: t.radiusSm, backgroundColor: p.red }} />
        </Row>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{t.label}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{t.corner} · {t.density} · r{t.radiusMd}</Text>
      </Col>
    </Pressable>
  );
}

// ── Nav Row ──────────────────────────────────────────────────────────────────

function NavRow(props: { section: SectionDef; active: boolean; onSelect: (id: SectionId) => void; matchCount?: number }) {
  const s = props.section;
  return (
    <Pressable onPress={() => props.onSelect(s.id)} style={{
      padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.active ? s.tone : COLORS.border,
      backgroundColor: props.active ? COLORS.panelHover : COLORS.panelRaised,
      gap: 4,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Glyph icon={s.icon} tone={s.tone} backgroundColor="transparent" tiny={true} />
        <Text fontSize={12} color={props.active ? COLORS.textBright : COLORS.text} style={{ fontWeight: 'bold' }}>{s.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        {typeof props.matchCount === 'number' && props.matchCount > 0 ? (
          <Pill label={String(props.matchCount)} color={COLORS.blue} tiny={true} />
        ) : null}
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{s.description}</Text>
    </Pressable>
  );
}

// ── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar(props: { query: string; onQuery: (q: string) => void }) {
  return (
    <Row style={{
      alignItems: 'center', gap: 8,
      padding: 10, borderRadius: TOKENS.radiusMd,
      borderWidth: 1, borderColor: COLORS.border,
      backgroundColor: COLORS.panelBg,
    }}>
      <Text fontSize={12} color={COLORS.textDim}>⌕</Text>
      <TextInput value={props.query} onChangeText={props.onQuery} placeholder="Search settings..."
        style={{ flexGrow: 1, height: 24, backgroundColor: 'transparent' }} />
      {props.query ? (
        <Pressable onPress={() => props.onQuery('')} style={{ paddingLeft: 8, paddingRight: 8 }}>
          <Text fontSize={10} color={COLORS.textDim}>clear</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ── Panels ───────────────────────────────────────────────────────────────────

function AppearancePanel() {
  const { name, setTheme } = useTheme();
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Appearance" description="Theme, density, and visual tokens." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Theme</Text>
        <Text fontSize={10} color={COLORS.textDim}>Sharp is terminal-feel with square corners. Soft is the tuned default. Studio is pro-tool muted and tight.</Text>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {THEME_ORDER.map((n: string) => (
            <ThemeSwatch key={n} name={n} active={n === name} onPress={() => setTheme(n)} />
          ))}
        </Row>
      </Box>
    </Col>
  );
}

function EditorPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Editor" description="Font size, tabs, wrap, line numbers." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>Editor settings coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function TerminalSettingsPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Terminal" description="Shell, font, cursor, scrollback." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>Terminal settings coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function KeybindingsPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Keybindings" description="Shortcuts and command palette." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>Keybindings coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function MemoryPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Memory" description="Variables, checkpoints, context depth." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>Memory settings coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function PluginsPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Plugins" description="Installed plugins, enable / disable." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>Plugins panel coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function AboutPanel() {
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="About" description="Version, build, capabilities." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textDim}>About panel coming in a later commit.</Text>
      </Box>
    </Col>
  );
}

function ProvidersPanel(props: {
  providerConfigs: ProviderConfig[];
  selectedProviderId: string;
  selectedModel: string;
  onSelectProvider: (id: string) => void;
  onToggleProvider: (id: string) => void;
  onUpdateProvider: (id: string, patch: any) => void;
  onSelectModel: (id: string, displayName: string, providerType: string) => void;
}) {
  const p = props.providerConfigs || [];
  const selectedProvider = p.find(x => x.type === props.selectedProviderId) || p[0];
  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Providers" description="Model providers, API keys, default routing." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Model Providers</Text>
        <Text fontSize={10} color={COLORS.textDim}>Select a provider to view and configure its models. Disabled providers stay visible so routing changes are reversible.</Text>
        <Col style={{ gap: 10 }}>
          {p.map(provider => (
            <ProviderCardCompact key={provider.type} provider={provider}
              active={provider.type === props.selectedProviderId}
              onSelect={props.onSelectProvider} onToggleEnabled={props.onToggleProvider} />
          ))}
        </Col>
      </Box>
      {selectedProvider ? (
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: getProviderIconInfo(selectedProvider.type).color || COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12, overflow: 'visible' }}>
          <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{getProviderIconInfo(selectedProvider.type).name} Models</Text>
            <Pressable onPress={() => props.onToggleProvider(selectedProvider.type)}>
              <Pill label={selectedProvider.enabled ? 'enabled' : 'disabled'} color={selectedProvider.enabled ? COLORS.green : COLORS.textMuted} tiny={true} />
            </Pressable>
          </Row>
          <Row style={{ gap: 10, flexWrap: 'wrap', overflow: 'visible' }}>
            <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
              <Text fontSize={10} color={COLORS.textDim}>Base URL</Text>
              <TextInput value={selectedProvider.baseUrl || ''}
                onChangeText={(value: string) => props.onUpdateProvider(selectedProvider.type, { baseUrl: value })}
                style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg }} />
            </Col>
            <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
              <ModelSelector label="Default Model"
                description="Provider default model used when a task does not specify one"
                value={{ provider: selectedProvider.type, modelId: selectedProvider.defaultModel }}
                onChange={(ref) => props.onUpdateProvider(selectedProvider.type, { defaultModel: ref.modelId })}
                providers={[selectedProvider]} allowDisabledProviders={true} />
            </Col>
          </Row>
          <Col style={{ gap: 8, overflow: 'visible' }}>
            {(selectedProvider.models || []).map(model => (
              <ModelRow key={model.id} model={model}
                selected={props.selectedModel === model.id}
                onSelect={() => props.onSelectModel(model.id, model.displayName, selectedProvider.type)} />
            ))}
          </Col>
        </Box>
      ) : null}
    </Col>
  );
}

// ── Root Surface ─────────────────────────────────────────────────────────────

export function SettingsSurface(props: any) {
  const stacked = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const sections = sectionList();
  const incomingSection: SectionId =
    LEGACY_SECTION_MAP[props.activeSection as string] ||
    (sections.find(s => s.id === props.activeSection)?.id as SectionId) ||
    'appearance';

  const [internalSection, setInternalSection] = useState<SectionId>(incomingSection);
  const [query, setQuery] = useState('');

  useEffect(() => { setInternalSection(incomingSection); }, [props.activeSection]);

  const active: SectionId = internalSection;

  function selectSection(id: SectionId) {
    setInternalSection(id);
    if (typeof props.onSelectSection === 'function') {
      try { props.onSelectSection(id); } catch {}
    }
  }

  function renderPanel() {
    if (active === 'appearance')  return <AppearancePanel />;
    if (active === 'editor')      return <EditorPanel />;
    if (active === 'terminal')    return <TerminalSettingsPanel />;
    if (active === 'keybindings') return <KeybindingsPanel />;
    if (active === 'providers')   return <ProvidersPanel
      providerConfigs={props.providerConfigs || []}
      selectedProviderId={props.selectedProviderId}
      selectedModel={props.selectedModel}
      onSelectProvider={props.onSelectProvider || (() => {})}
      onToggleProvider={props.onToggleProvider || (() => {})}
      onUpdateProvider={props.onUpdateProvider || (() => {})}
      onSelectModel={props.onSelectModel || (() => {})}
    />;
    if (active === 'memory')      return <MemoryPanel />;
    if (active === 'plugins')     return <PluginsPanel />;
    return <AboutPanel />;
  }

  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: stacked ? 12 : 18, gap: 16 }}>
        <Box style={{ padding: stacked ? 14 : 18, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>SETTINGS</Text>
          <FadeIn delay={60}>
            <Text fontSize={stacked ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              Workspace, providers, and behavior
            </Text>
          </FadeIn>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label={props.workspaceName || 'workspace'} color={COLORS.blue} />
            <Pill label={props.gitBranch || 'main'} color={COLORS.green} />
            <Pill label={props.selectedModelName || 'no model'} color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
          </Row>
          <SearchBar query={query} onQuery={setQuery} />
        </Box>

        <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
          <Col style={{ width: stacked ? '100%' : 240, gap: 8 }}>
            {sections.map(section => (
              <NavRow key={section.id} section={section} active={section.id === active} onSelect={selectSection} />
            ))}
          </Col>
          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 14 }}>
            {renderPanel()}
          </Col>
        </Box>
      </Col>
    </ScrollView>
  );
}
