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
import { deleteApiKey, getApiKey, hasApiKey, listApiKeys, setApiKey, validateApiKey } from '../api-keys';

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

const APPEARANCE_DEFAULTS = {
  uiScale: 100,
  accent: 'blue',
  animations: true,
  compactChrome: false,
  showFileGlyphs: true,
  showMinimap: false,
};

const ACCENT_OPTIONS: Array<{ value: string; label: string; swatch: string }> = [
  { value: 'blue',   label: 'Blue',   swatch: COLORS.blue },
  { value: 'green',  label: 'Green',  swatch: COLORS.green },
  { value: 'purple', label: 'Purple', swatch: COLORS.purple },
  { value: 'orange', label: 'Orange', swatch: COLORS.orange },
  { value: 'red',    label: 'Red',    swatch: COLORS.red },
  { value: 'yellow', label: 'Yellow', swatch: COLORS.yellow },
];

function AppearancePanel(props: { query: string; resetToken: number }) {
  const { name, setTheme } = useTheme();
  const [uiScale, setUiScaleState]         = useState<number>(sget('appearance.uiScale', APPEARANCE_DEFAULTS.uiScale));
  const [accent, setAccentState]           = useState<string>(sget('appearance.accent', APPEARANCE_DEFAULTS.accent));
  const [animations, setAnimationsState]   = useState<boolean>(sget('appearance.animations', APPEARANCE_DEFAULTS.animations));
  const [compactChrome, setCompactState]   = useState<boolean>(sget('appearance.compactChrome', APPEARANCE_DEFAULTS.compactChrome));
  const [showFileGlyphs, setGlyphsState]   = useState<boolean>(sget('appearance.showFileGlyphs', APPEARANCE_DEFAULTS.showFileGlyphs));
  const [showMinimap, setMinimapState]     = useState<boolean>(sget('appearance.showMinimap', APPEARANCE_DEFAULTS.showMinimap));

  useEffect(() => {
    setUiScaleState(sget('appearance.uiScale', APPEARANCE_DEFAULTS.uiScale));
    setAccentState(sget('appearance.accent', APPEARANCE_DEFAULTS.accent));
    setAnimationsState(sget('appearance.animations', APPEARANCE_DEFAULTS.animations));
    setCompactState(sget('appearance.compactChrome', APPEARANCE_DEFAULTS.compactChrome));
    setGlyphsState(sget('appearance.showFileGlyphs', APPEARANCE_DEFAULTS.showFileGlyphs));
    setMinimapState(sget('appearance.showMinimap', APPEARANCE_DEFAULTS.showMinimap));
  }, [props.resetToken]);

  const setUiScale = (v: number) => { setUiScaleState(v); sset('appearance.uiScale', v); };
  const setAccent = (v: string) => { setAccentState(v); sset('appearance.accent', v); };
  const setAnimations = (v: boolean) => { setAnimationsState(v); sset('appearance.animations', v); };
  const setCompact = (v: boolean) => { setCompactState(v); sset('appearance.compactChrome', v); };
  const setGlyphs = (v: boolean) => { setGlyphsState(v); sset('appearance.showFileGlyphs', v); };
  const setMinimap = (v: boolean) => { setMinimapState(v); sset('appearance.showMinimap', v); };

  function doReset() {
    setTheme('soft');
    setUiScale(APPEARANCE_DEFAULTS.uiScale);
    setAccent(APPEARANCE_DEFAULTS.accent);
    setAnimations(APPEARANCE_DEFAULTS.animations);
    setCompact(APPEARANCE_DEFAULTS.compactChrome);
    setGlyphs(APPEARANCE_DEFAULTS.showFileGlyphs);
    setMinimap(APPEARANCE_DEFAULTS.showMinimap);
  }

  const q = (props.query || '').toLowerCase();
  const match = (kw: string) => !q || kw.toLowerCase().indexOf(q) >= 0;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Appearance" description="Theme, density, font scale, and chrome." onReset={doReset} />

      {match('theme dark light sharp soft studio') ? (
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Theme</Text>
          <Text fontSize={10} color={COLORS.textDim}>Sharp is terminal-feel with square corners. Soft is the tuned default. Studio is pro-tool muted and tight.</Text>
          <Row style={{ gap: 10, flexWrap: 'wrap' }}>
            {THEME_ORDER.map((n: string) => (
              <ThemeSwatch key={n} name={n} active={n === name} onPress={() => setTheme(n)} />
            ))}
          </Row>
        </Box>
      ) : null}

      {match('ui scale font size zoom density') ? (
        <SettingRow title="UI scale" description="Scales all chrome fonts and padding (80–150%).">
          <Stepper value={uiScale} onChange={setUiScale} min={80} max={150} step={10} suffix="%" />
        </SettingRow>
      ) : null}

      {match('accent color highlight') ? (
        <SettingRow title="Accent color" description="Used for selection highlights and active states.">
          <Row style={{ gap: 6 }}>
            {ACCENT_OPTIONS.map(opt => {
              const active = opt.value === accent;
              return (
                <Pressable key={opt.value} onPress={() => setAccent(opt.value)} style={{
                  width: 24, height: 24,
                  borderRadius: TOKENS.radiusPill,
                  backgroundColor: opt.swatch,
                  borderWidth: active ? 3 : 1,
                  borderColor: active ? COLORS.textBright : COLORS.border,
                }} />
              );
            })}
          </Row>
        </SettingRow>
      ) : null}

      {match('animations motion reduce') ? (
        <SettingRow title="Animations" description="Fade and transition effects across the chrome.">
          <Toggle value={animations} onChange={setAnimations} />
        </SettingRow>
      ) : null}

      {match('compact chrome titlebar density') ? (
        <SettingRow title="Compact chrome" description="Tighter titlebar, shorter tab strip.">
          <Toggle value={compactChrome} onChange={setCompact} />
        </SettingRow>
      ) : null}

      {match('file glyphs icons sidebar') ? (
        <SettingRow title="Show file glyphs" description="Type letters shown next to files in the sidebar.">
          <Toggle value={showFileGlyphs} onChange={setGlyphs} />
        </SettingRow>
      ) : null}

      {match('minimap code overview') ? (
        <SettingRow title="Show minimap" description="Overview strip down the right edge of the editor.">
          <Toggle value={showMinimap} onChange={setMinimap} />
        </SettingRow>
      ) : null}
    </Col>
  );
}

const EDITOR_DEFAULTS = {
  fontSize: 13,
  lineHeight: 1.5,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: true,
  showLineNumbers: true,
  showWhitespace: false,
  trimTrailingWhitespace: true,
  formatOnSave: false,
  fontFamily: 'JetBrains Mono',
};

function EditorPanel(props: { query: string; resetToken: number }) {
  const [fontSize, setFontSizeS]             = useState<number>(sget('editor.fontSize', EDITOR_DEFAULTS.fontSize));
  const [lineHeight, setLineHeightS]         = useState<number>(sget('editor.lineHeight', EDITOR_DEFAULTS.lineHeight));
  const [tabSize, setTabSizeS]               = useState<number>(sget('editor.tabSize', EDITOR_DEFAULTS.tabSize));
  const [insertSpaces, setInsertSpacesS]     = useState<boolean>(sget('editor.insertSpaces', EDITOR_DEFAULTS.insertSpaces));
  const [wordWrap, setWordWrapS]             = useState<boolean>(sget('editor.wordWrap', EDITOR_DEFAULTS.wordWrap));
  const [showLineNumbers, setLineNumS]       = useState<boolean>(sget('editor.showLineNumbers', EDITOR_DEFAULTS.showLineNumbers));
  const [showWhitespace, setWsS]             = useState<boolean>(sget('editor.showWhitespace', EDITOR_DEFAULTS.showWhitespace));
  const [trimTrailing, setTrimS]             = useState<boolean>(sget('editor.trimTrailingWhitespace', EDITOR_DEFAULTS.trimTrailingWhitespace));
  const [formatOnSave, setFmtS]              = useState<boolean>(sget('editor.formatOnSave', EDITOR_DEFAULTS.formatOnSave));
  const [fontFamily, setFontFamilyS]         = useState<string>(sget('editor.fontFamily', EDITOR_DEFAULTS.fontFamily));

  useEffect(() => {
    setFontSizeS(sget('editor.fontSize', EDITOR_DEFAULTS.fontSize));
    setLineHeightS(sget('editor.lineHeight', EDITOR_DEFAULTS.lineHeight));
    setTabSizeS(sget('editor.tabSize', EDITOR_DEFAULTS.tabSize));
    setInsertSpacesS(sget('editor.insertSpaces', EDITOR_DEFAULTS.insertSpaces));
    setWordWrapS(sget('editor.wordWrap', EDITOR_DEFAULTS.wordWrap));
    setLineNumS(sget('editor.showLineNumbers', EDITOR_DEFAULTS.showLineNumbers));
    setWsS(sget('editor.showWhitespace', EDITOR_DEFAULTS.showWhitespace));
    setTrimS(sget('editor.trimTrailingWhitespace', EDITOR_DEFAULTS.trimTrailingWhitespace));
    setFmtS(sget('editor.formatOnSave', EDITOR_DEFAULTS.formatOnSave));
    setFontFamilyS(sget('editor.fontFamily', EDITOR_DEFAULTS.fontFamily));
  }, [props.resetToken]);

  const setFontSize = (v: number) => { setFontSizeS(v); sset('editor.fontSize', v); };
  const setLineHeight = (v: number) => { setLineHeightS(v); sset('editor.lineHeight', v); };
  const setTabSize = (v: number) => { setTabSizeS(v); sset('editor.tabSize', v); };
  const setInsertSpaces = (v: boolean) => { setInsertSpacesS(v); sset('editor.insertSpaces', v); };
  const setWordWrap = (v: boolean) => { setWordWrapS(v); sset('editor.wordWrap', v); };
  const setLineNum = (v: boolean) => { setLineNumS(v); sset('editor.showLineNumbers', v); };
  const setWs = (v: boolean) => { setWsS(v); sset('editor.showWhitespace', v); };
  const setTrim = (v: boolean) => { setTrimS(v); sset('editor.trimTrailingWhitespace', v); };
  const setFmt = (v: boolean) => { setFmtS(v); sset('editor.formatOnSave', v); };
  const setFontFamily = (v: string) => { setFontFamilyS(v); sset('editor.fontFamily', v); };

  function doReset() {
    setFontSize(EDITOR_DEFAULTS.fontSize);
    setLineHeight(EDITOR_DEFAULTS.lineHeight);
    setTabSize(EDITOR_DEFAULTS.tabSize);
    setInsertSpaces(EDITOR_DEFAULTS.insertSpaces);
    setWordWrap(EDITOR_DEFAULTS.wordWrap);
    setLineNum(EDITOR_DEFAULTS.showLineNumbers);
    setWs(EDITOR_DEFAULTS.showWhitespace);
    setTrim(EDITOR_DEFAULTS.trimTrailingWhitespace);
    setFmt(EDITOR_DEFAULTS.formatOnSave);
    setFontFamily(EDITOR_DEFAULTS.fontFamily);
  }

  const q = (props.query || '').toLowerCase();
  const match = (kw: string) => !q || kw.toLowerCase().indexOf(q) >= 0;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Editor" description="Typography, indentation, and save behaviour." onReset={doReset} />

      {match('font family monospace typeface') ? (
        <SettingRow title="Font family" description="Monospace font used across the editor surface.">
          <TextField value={fontFamily} onChange={setFontFamily} placeholder="JetBrains Mono" width={220} mono={true} />
        </SettingRow>
      ) : null}

      {match('font size type scale') ? (
        <SettingRow title="Font size" description="Point size for editor text.">
          <Stepper value={fontSize} onChange={setFontSize} min={8} max={28} step={1} suffix="pt" />
        </SettingRow>
      ) : null}

      {match('line height spacing leading') ? (
        <SettingRow title="Line height" description="Line-height multiplier relative to font size.">
          <Stepper value={Math.round(lineHeight * 10)} onChange={(v) => setLineHeight(v / 10)} min={10} max={25} step={1} suffix="/10" />
        </SettingRow>
      ) : null}

      {match('tab size indent width') ? (
        <SettingRow title="Tab size" description="How many spaces a tab renders as.">
          <Stepper value={tabSize} onChange={setTabSize} min={1} max={8} step={1} />
        </SettingRow>
      ) : null}

      {match('insert spaces tabs indent character') ? (
        <SettingRow title="Insert spaces" description="Use spaces for indentation instead of real tab characters.">
          <Toggle value={insertSpaces} onChange={setInsertSpaces} onLabel="SPACES" offLabel="TABS" />
        </SettingRow>
      ) : null}

      {match('word wrap soft line break') ? (
        <SettingRow title="Word wrap" description="Wrap long lines at the viewport edge.">
          <Toggle value={wordWrap} onChange={setWordWrap} />
        </SettingRow>
      ) : null}

      {match('line numbers gutter') ? (
        <SettingRow title="Line numbers" description="Show the gutter number on every line.">
          <Toggle value={showLineNumbers} onChange={setLineNum} />
        </SettingRow>
      ) : null}

      {match('whitespace dots invisible characters') ? (
        <SettingRow title="Render whitespace" description="Draw faint dots for spaces and arrows for tabs.">
          <Toggle value={showWhitespace} onChange={setWs} />
        </SettingRow>
      ) : null}

      {match('trim trailing whitespace') ? (
        <SettingRow title="Trim trailing whitespace" description="Strip trailing spaces from every line on save.">
          <Toggle value={trimTrailing} onChange={setTrim} />
        </SettingRow>
      ) : null}

      {match('format on save prettier') ? (
        <SettingRow title="Format on save" description="Run the formatter when a file is saved.">
          <Toggle value={formatOnSave} onChange={setFmt} />
        </SettingRow>
      ) : null}
    </Col>
  );
}

const TERMINAL_DEFAULTS = {
  shell: '/bin/bash',
  fontSize: 12,
  fontFamily: 'JetBrains Mono',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  bellSound: false,
  copyOnSelect: true,
};

function TerminalSettingsPanel(props: { query: string; resetToken: number }) {
  const [shell, setShellS]             = useState<string>(sget('terminal.shell', TERMINAL_DEFAULTS.shell));
  const [fontSize, setFontSizeS]       = useState<number>(sget('terminal.fontSize', TERMINAL_DEFAULTS.fontSize));
  const [fontFamily, setFontFamilyS]   = useState<string>(sget('terminal.fontFamily', TERMINAL_DEFAULTS.fontFamily));
  const [cursorStyle, setCursorStyleS] = useState<string>(sget('terminal.cursorStyle', TERMINAL_DEFAULTS.cursorStyle));
  const [cursorBlink, setCursorBlinkS] = useState<boolean>(sget('terminal.cursorBlink', TERMINAL_DEFAULTS.cursorBlink));
  const [scrollback, setScrollbackS]   = useState<number>(sget('terminal.scrollback', TERMINAL_DEFAULTS.scrollback));
  const [bellSound, setBellSoundS]     = useState<boolean>(sget('terminal.bellSound', TERMINAL_DEFAULTS.bellSound));
  const [copyOnSelect, setCopyS]       = useState<boolean>(sget('terminal.copyOnSelect', TERMINAL_DEFAULTS.copyOnSelect));

  useEffect(() => {
    setShellS(sget('terminal.shell', TERMINAL_DEFAULTS.shell));
    setFontSizeS(sget('terminal.fontSize', TERMINAL_DEFAULTS.fontSize));
    setFontFamilyS(sget('terminal.fontFamily', TERMINAL_DEFAULTS.fontFamily));
    setCursorStyleS(sget('terminal.cursorStyle', TERMINAL_DEFAULTS.cursorStyle));
    setCursorBlinkS(sget('terminal.cursorBlink', TERMINAL_DEFAULTS.cursorBlink));
    setScrollbackS(sget('terminal.scrollback', TERMINAL_DEFAULTS.scrollback));
    setBellSoundS(sget('terminal.bellSound', TERMINAL_DEFAULTS.bellSound));
    setCopyS(sget('terminal.copyOnSelect', TERMINAL_DEFAULTS.copyOnSelect));
  }, [props.resetToken]);

  const setShell = (v: string) => { setShellS(v); sset('terminal.shell', v); };
  const setFontSize = (v: number) => { setFontSizeS(v); sset('terminal.fontSize', v); };
  const setFontFamily = (v: string) => { setFontFamilyS(v); sset('terminal.fontFamily', v); };
  const setCursorStyle = (v: string) => { setCursorStyleS(v); sset('terminal.cursorStyle', v); };
  const setCursorBlink = (v: boolean) => { setCursorBlinkS(v); sset('terminal.cursorBlink', v); };
  const setScrollback = (v: number) => { setScrollbackS(v); sset('terminal.scrollback', v); };
  const setBellSound = (v: boolean) => { setBellSoundS(v); sset('terminal.bellSound', v); };
  const setCopyOnSelect = (v: boolean) => { setCopyS(v); sset('terminal.copyOnSelect', v); };

  function doReset() {
    setShell(TERMINAL_DEFAULTS.shell);
    setFontSize(TERMINAL_DEFAULTS.fontSize);
    setFontFamily(TERMINAL_DEFAULTS.fontFamily);
    setCursorStyle(TERMINAL_DEFAULTS.cursorStyle);
    setCursorBlink(TERMINAL_DEFAULTS.cursorBlink);
    setScrollback(TERMINAL_DEFAULTS.scrollback);
    setBellSound(TERMINAL_DEFAULTS.bellSound);
    setCopyOnSelect(TERMINAL_DEFAULTS.copyOnSelect);
  }

  const q = (props.query || '').toLowerCase();
  const match = (kw: string) => !q || kw.toLowerCase().indexOf(q) >= 0;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Terminal" description="Shell binary, font, cursor, and scrollback." onReset={doReset} />

      {match('shell bash zsh binary path') ? (
        <SettingRow title="Shell" description="Path to the shell binary the terminal should launch.">
          <TextField value={shell} onChange={setShell} placeholder="/bin/bash" width={220} mono={true} />
        </SettingRow>
      ) : null}

      {match('font family monospace typeface') ? (
        <SettingRow title="Font family" description="Monospace font used inside the terminal pane.">
          <TextField value={fontFamily} onChange={setFontFamily} placeholder="JetBrains Mono" width={220} mono={true} />
        </SettingRow>
      ) : null}

      {match('font size scale') ? (
        <SettingRow title="Font size" description="Point size for terminal text.">
          <Stepper value={fontSize} onChange={setFontSize} min={8} max={24} step={1} suffix="pt" />
        </SettingRow>
      ) : null}

      {match('cursor shape block underline bar') ? (
        <SettingRow title="Cursor style" description="Shape of the terminal caret.">
          <PillSelect value={cursorStyle} onChange={setCursorStyle} options={[
            { value: 'block',     label: 'Block'     },
            { value: 'underline', label: 'Underline' },
            { value: 'bar',       label: 'Bar'       },
          ]} />
        </SettingRow>
      ) : null}

      {match('cursor blink blinking') ? (
        <SettingRow title="Cursor blink" description="Pulse the terminal caret on and off.">
          <Toggle value={cursorBlink} onChange={setCursorBlink} />
        </SettingRow>
      ) : null}

      {match('scrollback lines buffer history') ? (
        <SettingRow title="Scrollback" description="Number of past lines kept in the terminal buffer.">
          <Stepper value={scrollback} onChange={setScrollback} min={500} max={50000} step={500} />
        </SettingRow>
      ) : null}

      {match('bell beep alert') ? (
        <SettingRow title="Bell sound" description="Audible beep on terminal bell escape.">
          <Toggle value={bellSound} onChange={setBellSound} />
        </SettingRow>
      ) : null}

      {match('copy selection clipboard') ? (
        <SettingRow title="Copy on select" description="Copy selected text to the clipboard automatically.">
          <Toggle value={copyOnSelect} onChange={setCopyOnSelect} />
        </SettingRow>
      ) : null}
    </Col>
  );
}

interface KeybindingSpec {
  id: string;
  label: string;
  category: string;
  defaultChord: string;
}

const KEYBINDINGS: KeybindingSpec[] = [
  { id: 'nav.settings',      label: 'Open Settings',        category: 'Navigation', defaultChord: 'Ctrl+,' },
  { id: 'nav.commandPalette',label: 'Open Command Palette', category: 'Navigation', defaultChord: 'Ctrl+K' },
  { id: 'nav.projects',      label: 'Open Projects',        category: 'Navigation', defaultChord: 'Ctrl+P' },
  { id: 'surface.search',    label: 'Toggle Search',        category: 'Surface',    defaultChord: 'Ctrl+Shift+F' },
  { id: 'surface.terminal',  label: 'Toggle Terminal',      category: 'Surface',    defaultChord: 'Ctrl+`' },
  { id: 'surface.chat',      label: 'Toggle Chat',          category: 'Surface',    defaultChord: 'Ctrl+L' },
  { id: 'surface.hot',       label: 'Toggle Hot Panel',     category: 'Surface',    defaultChord: 'Ctrl+H' },
  { id: 'file.new',          label: 'New File',             category: 'File',       defaultChord: 'Ctrl+N' },
  { id: 'file.save',         label: 'Save Current File',    category: 'File',       defaultChord: 'Ctrl+S' },
  { id: 'workspace.refresh', label: 'Refresh Workspace',    category: 'Workspace',  defaultChord: 'Ctrl+Shift+R' },
  { id: 'workspace.index',   label: 'Index Project',        category: 'Workspace',  defaultChord: 'Ctrl+Shift+I' },
  { id: 'agent.new',         label: 'New Conversation',     category: 'Agent',      defaultChord: 'Ctrl+Shift+N' },
  { id: 'agent.send',        label: 'Send Message',         category: 'Agent',      defaultChord: 'Ctrl+Enter' },
  { id: 'agent.cycleModel',  label: 'Cycle Model',          category: 'Agent',      defaultChord: 'Ctrl+/' },
  { id: 'agent.stop',        label: 'Stop Agent',           category: 'Agent',      defaultChord: 'Ctrl+.' },
];

function chordKey(id: string) { return 'keybindings.' + id; }

function KeybindingsPanel(props: { query: string; resetToken: number }) {
  const [version, setVersion] = useState(0);

  useEffect(() => { setVersion(v => v + 1); }, [props.resetToken]);

  function chordFor(spec: KeybindingSpec): string {
    return sget(chordKey(spec.id), spec.defaultChord);
  }
  function setChord(spec: KeybindingSpec, chord: string) {
    if (chord === spec.defaultChord) sdel(chordKey(spec.id));
    else sset(chordKey(spec.id), chord);
    setVersion(v => v + 1);
  }

  function doReset() {
    for (const spec of KEYBINDINGS) sdel(chordKey(spec.id));
    setVersion(v => v + 1);
  }

  const q = (props.query || '').toLowerCase();
  const filtered = KEYBINDINGS.filter(spec => {
    if (!q) return true;
    const hay = (spec.label + ' ' + spec.category + ' ' + spec.id + ' ' + chordFor(spec)).toLowerCase();
    return hay.indexOf(q) >= 0;
  });

  const groups: Record<string, KeybindingSpec[]> = {};
  for (const spec of filtered) {
    if (!groups[spec.category]) groups[spec.category] = [];
    groups[spec.category].push(spec);
  }

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Keybindings" description="Search and rebind command shortcuts. Edit the chord field to remap." onReset={doReset} />
      {filtered.length === 0 ? (
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
          <Text fontSize={11} color={COLORS.textDim}>No keybindings match "{props.query}".</Text>
        </Box>
      ) : null}
      {Object.keys(groups).map(category => (
        <Box key={category} style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Text fontSize={12} color={COLORS.blue} style={{ fontWeight: 'bold', letterSpacing: 0.6 }}>{category.toUpperCase()}</Text>
          <Col style={{ gap: 6 }}>
            {groups[category].map(spec => {
              const current = chordFor(spec);
              const customised = current !== spec.defaultChord;
              return (
                <Row key={spec.id + '_' + version} style={{
                  padding: 10, gap: 10,
                  borderRadius: TOKENS.radiusSm, borderWidth: 1,
                  borderColor: customised ? COLORS.orange : COLORS.border,
                  backgroundColor: COLORS.panelBg,
                  alignItems: 'center', flexWrap: 'wrap',
                }}>
                  <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 200, gap: 2 }}>
                    <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{spec.label}</Text>
                    <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{spec.id}</Text>
                  </Col>
                  <TextField value={current} onChange={(v) => setChord(spec, v)} width={160} mono={true} />
                  {customised ? (
                    <Pressable onPress={() => setChord(spec, spec.defaultChord)} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                      <Text fontSize={9} color={COLORS.textDim}>default</Text>
                    </Pressable>
                  ) : null}
                </Row>
              );
            })}
          </Col>
        </Box>
      ))}
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

function ApiKeyField(props: { provider: string; onChange: () => void }) {
  const [draft, setDraft]   = useState<string>('');
  const [reveal, setReveal] = useState<boolean>(false);
  const [error, setError]   = useState<string>('');
  const stored = hasApiKey(props.provider);
  const current = stored ? (getApiKey(props.provider) || '') : '';
  const display = reveal ? current : (current ? '•'.repeat(Math.min(current.length, 20)) : '');

  function doSave() {
    const value = draft.trim();
    if (!value) { setError('Key cannot be empty'); return; }
    const v = validateApiKey(props.provider, value);
    if (!v.valid) { setError(v.error || 'invalid key'); return; }
    setApiKey(props.provider, value);
    setDraft(''); setError('');
    props.onChange();
  }
  function doDelete() {
    deleteApiKey(props.provider);
    setDraft(''); setError('');
    props.onChange();
  }

  return (
    <Col style={{ gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>API Key</Text>
        <Pill label={stored ? 'stored' : 'not set'} color={stored ? COLORS.green : COLORS.textMuted} tiny={true} />
        {stored ? (
          <Pressable onPress={() => setReveal(!reveal)}>
            <Pill label={reveal ? 'hide' : 'reveal'} color={COLORS.blue} tiny={true} />
          </Pressable>
        ) : null}
      </Row>
      {stored && display ? (
        <Box style={{ padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{display}</Text>
        </Box>
      ) : null}
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={stored ? 'Replace key…' : 'Paste provider key…'}
          style={{ flexGrow: 1, flexBasis: 0, minWidth: 220, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
        <Pressable onPress={doSave} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{stored ? 'Replace' : 'Save'}</Text>
        </Pressable>
        {stored ? (
          <Pressable onPress={doDelete} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>Delete</Text>
          </Pressable>
        ) : null}
      </Row>
      {error ? <Text fontSize={10} color={COLORS.red}>{error}</Text> : null}
    </Col>
  );
}

function ProvidersPanel(props: {
  query: string;
  providerConfigs: ProviderConfig[];
  selectedProviderId: string;
  selectedModel: string;
  onSelectProvider: (id: string) => void;
  onToggleProvider: (id: string) => void;
  onUpdateProvider: (id: string, patch: any) => void;
  onSelectModel: (id: string, displayName: string, providerType: string) => void;
}) {
  const [keyVersion, setKeyVersion] = useState(0);
  const p = props.providerConfigs || [];
  const q = (props.query || '').toLowerCase();
  const filtered = q
    ? p.filter(x => {
        const name = (getProviderIconInfo(x.type).name + ' ' + x.type + ' ' + (x.baseUrl || '')).toLowerCase();
        return name.indexOf(q) >= 0;
      })
    : p;
  const selectedProvider = filtered.find(x => x.type === props.selectedProviderId) || filtered[0] || p[0];
  const storedKeyCount = listApiKeys().length;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Providers" description="Model providers, API keys, and default routing." />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Model Providers</Text>
          <Pill label={p.filter(x => x.enabled).length + '/' + p.length + ' enabled'} color={COLORS.blue} tiny={true} />
          <Pill label={storedKeyCount + ' key' + (storedKeyCount === 1 ? '' : 's')} color={storedKeyCount > 0 ? COLORS.green : COLORS.textMuted} tiny={true} />
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>Select a provider to view and configure its models. Disabled providers stay visible so routing changes are reversible.</Text>
        <Col style={{ gap: 10 }}>
          {filtered.map(provider => (
            <ProviderCardCompact key={provider.type + '_' + keyVersion} provider={provider}
              active={provider.type === props.selectedProviderId}
              onSelect={props.onSelectProvider} onToggleEnabled={props.onToggleProvider} />
          ))}
          {filtered.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim}>No providers match "{props.query}".</Text>
          ) : null}
        </Col>
      </Box>
      {selectedProvider ? (
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: getProviderIconInfo(selectedProvider.type).color || COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12, overflow: 'visible' }}>
          <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{getProviderIconInfo(selectedProvider.type).name}</Text>
            <Pressable onPress={() => props.onToggleProvider(selectedProvider.type)}>
              <Pill label={selectedProvider.enabled ? 'enabled' : 'disabled'} color={selectedProvider.enabled ? COLORS.green : COLORS.textMuted} tiny={true} />
            </Pressable>
            <Pill label={hasApiKey(selectedProvider.type) ? 'key stored' : 'no key'} color={hasApiKey(selectedProvider.type) ? COLORS.green : COLORS.textMuted} tiny={true} />
          </Row>

          <ApiKeyField provider={selectedProvider.type} onChange={() => setKeyVersion(v => v + 1)} />

          <Row style={{ gap: 10, flexWrap: 'wrap', overflow: 'visible' }}>
            <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Base URL</Text>
              <Text fontSize={10} color={COLORS.textDim}>Provider endpoint host. Leave blank for embedded / local providers.</Text>
              <TextInput value={selectedProvider.baseUrl || ''}
                onChangeText={(value: string) => props.onUpdateProvider(selectedProvider.type, { baseUrl: value })}
                style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg }} />
            </Col>
            <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 220, overflow: 'visible' }}>
              <ModelSelector label="Default Model"
                description="Provider default model used when a task does not specify one."
                value={{ provider: selectedProvider.type, modelId: selectedProvider.defaultModel }}
                onChange={(ref) => props.onUpdateProvider(selectedProvider.type, { defaultModel: ref.modelId })}
                providers={[selectedProvider]} allowDisabledProviders={true} />
            </Col>
          </Row>

          <Col style={{ gap: 8, overflow: 'visible' }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Models</Text>
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
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => { setInternalSection(incomingSection); }, [props.activeSection]);

  const active: SectionId = internalSection;

  function selectSection(id: SectionId) {
    setInternalSection(id);
    if (typeof props.onSelectSection === 'function') {
      try { props.onSelectSection(id); } catch {}
    }
  }

  function renderPanel() {
    if (active === 'appearance')  return <AppearancePanel query={query} resetToken={resetToken} />;
    if (active === 'editor')      return <EditorPanel query={query} resetToken={resetToken} />;
    if (active === 'terminal')    return <TerminalSettingsPanel query={query} resetToken={resetToken} />;
    if (active === 'keybindings') return <KeybindingsPanel query={query} resetToken={resetToken} />;
    if (active === 'providers')   return <ProvidersPanel
      query={query}
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
