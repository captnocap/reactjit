
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../theme';
import { THEME_ORDER, THEMES } from '../themes';
import { Glyph, Pill } from './shared';
import { FadeIn, PageModeTransition } from '../anim';
import { KeybindEditor } from './keybind-editor/KeybindEditor';
import { getProviderIconInfo, getModelIconInfo } from '../model-icons';
import type { ProviderConfig, ModelConfig } from '../providers';
import type { ModelReference } from '../default-models';
import { deleteApiKey, getApiKey, hasApiKey, listApiKeys, setApiKey, validateApiKey } from '../api-keys';
import {
  SETTINGS_SECTIONS,
  countSettingsSectionMatches,
  type SettingsSectionDef,
  type SettingsSectionId,
  searchSettingsIndex,
} from '../lib/settings/search-index';
import { SettingsSearchInput } from './settings/SettingsSearchInput';
import { SettingsSearchResults } from './settings/SettingsSearchResults';

// =============================================================================
// SETTINGS — 8-section surface: Appearance, Editor, Terminal, Keybindings,
// Providers, Memory, Plugins, About. Real controls that map to state and
// persist via __store_get / __store_set host bindings.
// =============================================================================

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const storeDel = typeof host.__store_del === 'function' ? host.__store_del : (_: string) => {};

const KEY = 'sweatshop.settings';

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

type SectionId = SettingsSectionId;
type SectionDef = SettingsSectionDef;

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
  scrolling: 'scrolling',
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
    <Row style={{ gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <Pressable onPress={() => props.onSelect(p.type)} style={{
        flexGrow: 1, flexBasis: 220, flexShrink: 1, padding: 12, borderRadius: TOKENS.radiusMd,
        borderWidth: 1, borderColor: props.active ? icon.color : COLORS.border,
        backgroundColor: props.active ? COLORS.panelHover : COLORS.panelRaised, gap: 8,
      }}>
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <IconBadge providerId={p.type} />
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 120 }}>
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
        flexShrink: 0, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
        borderRadius: TOKENS.radiusMd, borderWidth: 1,
        borderColor: p.enabled ? COLORS.green : COLORS.border,
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
    <Pressable onPress={props.onPress} style={{ flexShrink: 1, flexGrow: 0, flexBasis: 120, maxWidth: 200 }}>
      <Col style={{
        padding: 10, gap: 8,
        borderRadius: t.radiusMd,
        borderWidth: props.active ? 2 : 1,
        borderColor: props.active ? p.blue : COLORS.border,
        backgroundColor: COLORS.panelRaised,
      }}>
        <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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

// ── Export / Import ──────────────────────────────────────────────────────────
// Dumps and restores every panel's settings. Reads through sget/sdel so we
// don't need a host "list keys" API — the full set of tracked paths is
// enumerated here and kept in sync with the panels above.

const EXPORT_VERSION = 1;

const APPEARANCE_KEYS: string[] = ['uiScale', 'accent', 'animations', 'compactChrome', 'showFileGlyphs', 'showMinimap'];
const EDITOR_KEYS:     string[] = ['fontFamily', 'fontSize', 'lineHeight', 'tabSize', 'insertSpaces', 'wordWrap', 'showLineNumbers', 'showWhitespace', 'trimTrailingWhitespace', 'formatOnSave'];
const TERMINAL_KEYS:   string[] = ['shell', 'fontFamily', 'fontSize', 'cursorStyle', 'cursorBlink', 'scrollback', 'bellSound', 'copyOnSelect'];
const MEMORY_KEYS:     string[] = ['provider', 'contextTokens', 'retentionDays', 'checkpointLimit', 'autoCheckpoint', 'semanticSearch'];
const BACKEND_KEYS:    string[] = ['enabled', 'cliPath', 'baseUrl', 'defaultModel', 'workingDir'];

interface SettingsDump {
  version: number;
  exportedAt: string;
  appearance: Record<string, any>;
  editor: Record<string, any>;
  terminal: Record<string, any>;
  memory: Record<string, any>;
  keybindings: Record<string, string>;
  plugins: Record<string, boolean>;
  providers: Record<string, any>;
  providersLocalCustom: any;
}

function exportSettings(): SettingsDump {
  const dump: SettingsDump = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appearance: {},
    editor: {},
    terminal: {},
    memory: {},
    keybindings: {},
    plugins: {},
    providers: {},
    providersLocalCustom: sget('providers.local.custom', null),
  };
  for (const k of APPEARANCE_KEYS) dump.appearance[k] = sget('appearance.' + k, null);
  for (const k of EDITOR_KEYS)     dump.editor[k]     = sget('editor.' + k, null);
  for (const k of TERMINAL_KEYS)   dump.terminal[k]   = sget('terminal.' + k, null);
  for (const k of MEMORY_KEYS)     dump.memory[k]     = sget('memory.' + k, null);
  // Keybindings: only record explicit overrides so defaults stay live.
  for (const spec of KEYBINDINGS) {
    const raw = sget('keybindings.' + spec.id, null as any);
    if (raw !== null && raw !== undefined && raw !== '' && raw !== spec.defaultChord) {
      dump.keybindings[spec.id] = String(raw);
    }
  }
  // Plugins: the set of plugin ids isn't static — serialise every id we find.
  try {
    const h: any = globalThis;
    const pd: string = (typeof h.__env_home === 'string' ? h.__env_home : '/home/siah') + '/.sweatshop/plugins';
    if (typeof h.__fs_list_json === 'function') {
      const raw = h.__fs_list_json(pd);
      const list: string[] = JSON.parse(typeof raw === 'string' ? raw : '[]');
      for (const filename of list) {
        if (!filename.endsWith('.js')) continue;
        const id = filename.replace(/\.js$/, '');
        dump.plugins[id] = sget('plugins.enabled.' + id, true);
      }
    }
  } catch {}
  // Providers: per-backend config + enable.
  for (const entry of BACKEND_ENTRIES) {
    const per: Record<string, any> = {};
    for (const k of BACKEND_KEYS) {
      const v = sget('providers.' + entry.id + '.' + k, null as any);
      if (v !== null && v !== undefined && v !== '') per[k] = v;
    }
    if (Object.keys(per).length > 0) dump.providers[entry.id] = per;
  }
  return dump;
}

interface ImportReport { applied: number; skipped: number; error?: string }

function importSettings(json: string): ImportReport {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch (err: any) { return { applied: 0, skipped: 0, error: 'Invalid JSON: ' + (err && err.message ? err.message : 'parse failed') }; }
  if (!parsed || typeof parsed !== 'object') return { applied: 0, skipped: 0, error: 'Top-level must be an object' };
  if (typeof parsed.version !== 'number') return { applied: 0, skipped: 0, error: "Missing numeric 'version' field" };
  if (parsed.version > EXPORT_VERSION) return { applied: 0, skipped: 0, error: 'Settings file version ' + parsed.version + ' is newer than supported ' + EXPORT_VERSION };

  let applied = 0;
  let skipped = 0;
  function writeMap(prefix: string, map: any, allow: string[] | null) {
    if (!map || typeof map !== 'object') return;
    for (const k of Object.keys(map)) {
      if (allow && allow.indexOf(k) < 0) { skipped++; continue; }
      const v = map[k];
      if (v === null || v === undefined) { sdel(prefix + k); applied++; continue; }
      sset(prefix + k, v);
      applied++;
    }
  }
  writeMap('appearance.', parsed.appearance, APPEARANCE_KEYS);
  writeMap('editor.',     parsed.editor,     EDITOR_KEYS);
  writeMap('terminal.',   parsed.terminal,   TERMINAL_KEYS);
  writeMap('memory.',     parsed.memory,     MEMORY_KEYS);

  if (parsed.keybindings && typeof parsed.keybindings === 'object') {
    const known = new Set(KEYBINDINGS.map(k => k.id));
    for (const id of Object.keys(parsed.keybindings)) {
      if (!known.has(id)) { skipped++; continue; }
      const v = parsed.keybindings[id];
      if (typeof v !== 'string' || !v) { sdel('keybindings.' + id); applied++; continue; }
      sset('keybindings.' + id, v);
      applied++;
    }
  }

  if (parsed.plugins && typeof parsed.plugins === 'object') {
    for (const id of Object.keys(parsed.plugins)) {
      const v = parsed.plugins[id];
      if (typeof v !== 'boolean') { skipped++; continue; }
      sset('plugins.enabled.' + id, v);
      applied++;
    }
  }

  if (parsed.providers && typeof parsed.providers === 'object') {
    const known = new Set(BACKEND_ENTRIES.map(e => e.id));
    for (const id of Object.keys(parsed.providers)) {
      if (!known.has(id)) { skipped++; continue; }
      const cfg = parsed.providers[id];
      if (!cfg || typeof cfg !== 'object') { skipped++; continue; }
      for (const k of BACKEND_KEYS) {
        if (k in cfg) { sset('providers.' + id + '.' + k, cfg[k]); applied++; }
      }
    }
  }

  if (parsed.providersLocalCustom !== undefined) {
    if (Array.isArray(parsed.providersLocalCustom)) {
      sset('providers.local.custom', parsed.providersLocalCustom);
      applied++;
    } else {
      sdel('providers.local.custom');
    }
  }

  return { applied, skipped };
}

function ImportExportCard(props: { query: string }) {
  const [open, setOpen]           = useState<'none' | 'export' | 'import'>('none');
  const [exportText, setExportText] = useState<string>('');
  const [importText, setImportText] = useState<string>('');
  const [status, setStatus]         = useState<{ tone: string; message: string } | null>(null);

  function doExport() {
    try {
      const dump = exportSettings();
      setExportText(JSON.stringify(dump, null, 2));
      setOpen('export');
      setStatus({ tone: COLORS.green, message: 'Settings exported — copy the JSON below.' });
    } catch (err: any) {
      setStatus({ tone: COLORS.red, message: 'Export failed: ' + (err && err.message ? err.message : 'unknown error') });
    }
  }

  function doImport() {
    const report = importSettings(importText);
    if (report.error) {
      setStatus({ tone: COLORS.red, message: report.error });
      return;
    }
    setStatus({ tone: COLORS.green, message: 'Imported ' + report.applied + ' setting' + (report.applied === 1 ? '' : 's') + (report.skipped ? ', skipped ' + report.skipped : '') + '.' });
    setImportText('');
    setOpen('none');
  }

  const q = (props.query || '').toLowerCase();
  if (q && 'export import settings json backup restore'.indexOf(q) < 0) return null;

  return (
    <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Export / Import</Text>
        <Text fontSize={10} color={COLORS.textDim}>Round-trip every setting as a single JSON blob. Useful for sharing config or migrating across machines.</Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={doExport} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Export settings</Text>
        </Pressable>
        <Pressable onPress={() => { setOpen(open === 'import' ? 'none' : 'import'); setStatus(null); }} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: open === 'import' ? COLORS.blue : COLORS.border }}>
          <Text fontSize={11} color={open === 'import' ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>Import settings</Text>
        </Pressable>
        {open !== 'none' ? (
          <Pressable onPress={() => { setOpen('none'); setStatus(null); }} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={11} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      {status ? (
        <Text fontSize={10} color={status.tone}>{status.message}</Text>
      ) : null}

      {open === 'export' ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>Select all and copy. Paste into the Import pane on another machine to apply.</Text>
          <TextInput value={exportText} onChangeText={(v: string) => setExportText(v)} multiline={true}
            style={{ height: 220, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, padding: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
        </Col>
      ) : null}

      {open === 'import' ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>Paste a previously exported JSON blob. Unknown keys are skipped, known ones are applied to the store.</Text>
          <TextInput value={importText} onChangeText={setImportText} placeholder='{"version":1,"appearance":{...}}' multiline={true}
            style={{ height: 160, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, padding: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          <Row style={{ gap: 8 }}>
            <Pressable onPress={doImport} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.greenDeep, borderWidth: 1, borderColor: COLORS.green }}>
              <Text fontSize={11} color={COLORS.green} style={{ fontWeight: 'bold' }}>Apply</Text>
            </Pressable>
          </Row>
        </Col>
      ) : null}
    </Box>
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
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10, overflow: 'hidden' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Theme</Text>
          <Text fontSize={10} color={COLORS.textDim}>Sharp is terminal-feel with square corners. Soft is the tuned default. Studio is pro-tool muted and tight.</Text>
          <Row style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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

      <ImportExportCard query={props.query} />
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

const SCROLLING_DEFAULTS = {
  editorDragToScroll: true,
  terminalDragToScroll: true,
  chatDragToScroll: true,
  searchDragToScroll: true,
  diffDragToScroll: true,
  gitDragToScroll: true,
};

function ScrollingPanel(props: { query: string; resetToken: number }) {
  const [editorDragToScroll, setEditorDragToScrollS] = useState<boolean>(sget('scrolling.editorDragToScroll', SCROLLING_DEFAULTS.editorDragToScroll));
  const [terminalDragToScroll, setTerminalDragToScrollS] = useState<boolean>(sget('scrolling.terminalDragToScroll', SCROLLING_DEFAULTS.terminalDragToScroll));
  const [chatDragToScroll, setChatDragToScrollS] = useState<boolean>(sget('scrolling.chatDragToScroll', SCROLLING_DEFAULTS.chatDragToScroll));
  const [searchDragToScroll, setSearchDragToScrollS] = useState<boolean>(sget('scrolling.searchDragToScroll', SCROLLING_DEFAULTS.searchDragToScroll));
  const [diffDragToScroll, setDiffDragToScrollS] = useState<boolean>(sget('scrolling.diffDragToScroll', SCROLLING_DEFAULTS.diffDragToScroll));
  const [gitDragToScroll, setGitDragToScrollS] = useState<boolean>(sget('scrolling.gitDragToScroll', SCROLLING_DEFAULTS.gitDragToScroll));

  useEffect(() => {
    setEditorDragToScrollS(sget('scrolling.editorDragToScroll', SCROLLING_DEFAULTS.editorDragToScroll));
    setTerminalDragToScrollS(sget('scrolling.terminalDragToScroll', SCROLLING_DEFAULTS.terminalDragToScroll));
    setChatDragToScrollS(sget('scrolling.chatDragToScroll', SCROLLING_DEFAULTS.chatDragToScroll));
    setSearchDragToScrollS(sget('scrolling.searchDragToScroll', SCROLLING_DEFAULTS.searchDragToScroll));
    setDiffDragToScrollS(sget('scrolling.diffDragToScroll', SCROLLING_DEFAULTS.diffDragToScroll));
    setGitDragToScrollS(sget('scrolling.gitDragToScroll', SCROLLING_DEFAULTS.gitDragToScroll));
  }, [props.resetToken]);

  const setEditorDragToScroll = (v: boolean) => { setEditorDragToScrollS(v); sset('scrolling.editorDragToScroll', v); };
  const setTerminalDragToScroll = (v: boolean) => { setTerminalDragToScrollS(v); sset('scrolling.terminalDragToScroll', v); };
  const setChatDragToScroll = (v: boolean) => { setChatDragToScrollS(v); sset('scrolling.chatDragToScroll', v); };
  const setSearchDragToScroll = (v: boolean) => { setSearchDragToScrollS(v); sset('scrolling.searchDragToScroll', v); };
  const setDiffDragToScroll = (v: boolean) => { setDiffDragToScrollS(v); sset('scrolling.diffDragToScroll', v); };
  const setGitDragToScroll = (v: boolean) => { setGitDragToScrollS(v); sset('scrolling.gitDragToScroll', v); };

  function doReset() {
    setEditorDragToScroll(SCROLLING_DEFAULTS.editorDragToScroll);
    setTerminalDragToScroll(SCROLLING_DEFAULTS.terminalDragToScroll);
    setChatDragToScroll(SCROLLING_DEFAULTS.chatDragToScroll);
    setSearchDragToScroll(SCROLLING_DEFAULTS.searchDragToScroll);
    setDiffDragToScroll(SCROLLING_DEFAULTS.diffDragToScroll);
    setGitDragToScroll(SCROLLING_DEFAULTS.gitDragToScroll);
  }

  const q = (props.query || '').toLowerCase();
  const match = (kw: string) => !q || kw.toLowerCase().indexOf(q) >= 0;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Scrolling" description="Overlay scrollbars, drag panning, and synchronized diff panes." onReset={doReset} />

      {match('scrollbars overlay drag panning sync') ? (
        <SettingRow title="Editor drag-to-scroll" description="Hold and drag inside long editor buffers to pan the viewport.">
          <Toggle value={editorDragToScroll} onChange={setEditorDragToScroll} />
        </SettingRow>
      ) : null}

      {match('terminal scrollback drag scroll history') ? (
        <SettingRow title="Terminal drag-to-scroll" description="Drag inside terminal history / scrollback panes.">
          <Toggle value={terminalDragToScroll} onChange={setTerminalDragToScroll} />
        </SettingRow>
      ) : null}

      {match('chat message list drag scroll') ? (
        <SettingRow title="Chat drag-to-scroll" description="Drag inside the conversation transcript to pan the message list.">
          <Toggle value={chatDragToScroll} onChange={setChatDragToScroll} />
        </SettingRow>
      ) : null}

      {match('search results drag scroll') ? (
        <SettingRow title="Search drag-to-scroll" description="Drag inside the search results surface.">
          <Toggle value={searchDragToScroll} onChange={setSearchDragToScroll} />
        </SettingRow>
      ) : null}

      {match('diff side by side gutters sync') ? (
        <SettingRow title="Diff drag-to-scroll" description="Drag inside side-by-side diff panes and keep gutters aligned.">
          <Toggle value={diffDragToScroll} onChange={setDiffDragToScroll} />
        </SettingRow>
      ) : null}

      {match('git commit list history drag scroll') ? (
        <SettingRow title="Git history drag-to-scroll" description="Drag inside the commit history / log list.">
          <Toggle value={gitDragToScroll} onChange={setGitDragToScroll} />
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

// Map a DOM-style key event to a canonical chord string (e.g. "Ctrl+Shift+K").
// Accepts any object with the standard keyboard-event shape; modifier-only
// presses return '' so the caller can wait for a real chord.
function chordFromEvent(event: any): string {
  if (!event) return '';
  const key: string = typeof event.key === 'string' ? event.key : '';
  if (!key) return '';
  const lower = key.toLowerCase();
  if (lower === 'control' || lower === 'shift' || lower === 'alt' || lower === 'meta') return '';
  const parts: string[] = [];
  if (event.ctrlKey)  parts.push('Ctrl');
  if (event.altKey)   parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey)  parts.push('Meta');
  let main: string;
  if (key === ' ') main = 'Space';
  else if (key.length === 1) main = key.toUpperCase();
  else if (lower === 'escape') main = 'Escape';
  else if (lower === 'enter') main = 'Enter';
  else if (lower === 'tab') main = 'Tab';
  else if (lower === 'backspace') main = 'Backspace';
  else if (lower === 'delete') main = 'Delete';
  else if (lower === 'arrowup') main = 'Up';
  else if (lower === 'arrowdown') main = 'Down';
  else if (lower === 'arrowleft') main = 'Left';
  else if (lower === 'arrowright') main = 'Right';
  else main = key.charAt(0).toUpperCase() + key.slice(1);
  parts.push(main);
  return parts.join('+');
}

function KeybindingsPanel(props: { query: string; resetToken: number }) {
  const [version, setVersion] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; chord: string } | null>(null);

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
    setRecordingId(null);
    setEditingId(null);
    setFlash(null);
  }

  // Global key-capture while in recording mode. Captures the chord, persists,
  // exits recording. Escape cancels; everything else is swallowed so the
  // captured chord does not also trigger its normal shortcut action.
  useEffect(() => {
    if (!recordingId) return;
    const target: any = (typeof window !== 'undefined') ? window : globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;
    const onKey = (event: any) => {
      try { event.preventDefault && event.preventDefault(); } catch {}
      try { event.stopPropagation && event.stopPropagation(); } catch {}
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === 'escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        setRecordingId(null);
        return;
      }
      const chord = chordFromEvent(event);
      if (!chord) return; // modifier-only, wait for the real key
      const spec = KEYBINDINGS.find(k => k.id === recordingId);
      if (!spec) { setRecordingId(null); return; }
      setChord(spec, chord);
      setFlash({ id: spec.id, chord });
      setRecordingId(null);
    };
    target.addEventListener('keydown', onKey, true);
    return () => { try { target.removeEventListener('keydown', onKey, true); } catch {} };
  }, [recordingId]);

  // Build a conflict map so rows can warn when two bindings share a chord.
  const chordOwners: Record<string, string[]> = {};
  for (const spec of KEYBINDINGS) {
    const c = chordFor(spec);
    if (!chordOwners[c]) chordOwners[c] = [];
    chordOwners[c].push(spec.id);
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
      <SectionTitle title="Keybindings" description="Click Record, press the keys you want — Escape cancels." onReset={doReset} />

      {recordingId ? (
        <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.orange, backgroundColor: COLORS.orangeDeep, gap: 6 }}>
          <Row style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text fontSize={11} color={COLORS.orange} style={{ fontWeight: 'bold' }}>Recording…</Text>
            <Text fontSize={10} color={COLORS.text}>Press the new chord for <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{recordingId}</Text>. Escape cancels.</Text>
            <Box style={{ flexGrow: 1 }} />
            <Pressable onPress={() => setRecordingId(null)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Cancel</Text>
            </Pressable>
          </Row>
        </Box>
      ) : null}

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
              const isRecording = recordingId === spec.id;
              const isEditing = editingId === spec.id;
              const justFlashed = flash && flash.id === spec.id && flash.chord === current;
              const owners = chordOwners[current] || [];
              const conflict = current && owners.length > 1 ? owners.filter(id => id !== spec.id) : [];
              const borderTone = isRecording ? COLORS.orange : conflict.length ? COLORS.red : customised ? COLORS.orange : COLORS.border;
              return (
                <Col key={spec.id + '_' + version} style={{
                  padding: 10, gap: 6,
                  borderRadius: TOKENS.radiusSm, borderWidth: 1,
                  borderColor: borderTone,
                  backgroundColor: justFlashed ? COLORS.greenDeep : COLORS.panelBg,
                }}>
                  <Row style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Col style={{ flexGrow: 1, flexBasis: 160, flexShrink: 1, gap: 2 }}>
                      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{spec.label}</Text>
                      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{spec.id}</Text>
                    </Col>
                    <Box style={{
                      flexShrink: 1, minWidth: 100, maxWidth: 220,
                      paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                      borderRadius: TOKENS.radiusSm, borderWidth: 1,
                      borderColor: isRecording ? COLORS.orange : COLORS.border,
                      backgroundColor: isRecording ? COLORS.orangeDeep : COLORS.panelAlt,
                      overflow: 'hidden',
                    }}>
                      <Text fontSize={11} color={isRecording ? COLORS.orange : COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {isRecording ? 'press keys…' : (current || 'unbound')}
                      </Text>
                    </Box>
                    {isRecording ? (
                      <Pressable onPress={() => setRecordingId(null)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                        <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Cancel</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => { setEditingId(null); setFlash(null); setRecordingId(spec.id); }} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                        <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Record</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => setEditingId(isEditing ? null : spec.id)} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: isEditing ? COLORS.panelHover : COLORS.panelAlt }}>
                      <Text fontSize={10} color={isEditing ? COLORS.blue : COLORS.textDim}>{isEditing ? 'done' : 'type'}</Text>
                    </Pressable>
                    {customised ? (
                      <Pressable onPress={() => setChord(spec, spec.defaultChord)} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                        <Text fontSize={10} color={COLORS.textDim}>default</Text>
                      </Pressable>
                    ) : null}
                  </Row>
                  {isEditing ? (
                    <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text fontSize={10} color={COLORS.textDim}>Chord string:</Text>
                      <TextField value={current} onChange={(v) => setChord(spec, v)} width={200} mono={true} />
                    </Row>
                  ) : null}
                  {conflict.length > 0 ? (
                    <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Pill label="conflict" color={COLORS.red} tiny={true} />
                      <Text fontSize={10} color={COLORS.red}>Also bound to:</Text>
                      {conflict.map(id => (
                        <Text key={id} fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{id}</Text>
                      ))}
                    </Row>
                  ) : null}
                </Col>
              );
            })}
          </Col>
        </Box>
      ))}
    </Col>
  );
}

const MEMORY_DEFAULTS = {
  provider: 'local',
  contextTokens: 64000,
  retentionDays: 30,
  checkpointLimit: 50,
  autoCheckpoint: true,
  semanticSearch: true,
};

function MemoryPanel(props: { query: string; resetToken: number }) {
  const [provider, setProviderS]           = useState<string>(sget('memory.provider', MEMORY_DEFAULTS.provider));
  const [contextTokens, setCtxS]           = useState<number>(sget('memory.contextTokens', MEMORY_DEFAULTS.contextTokens));
  const [retentionDays, setRetentionS]     = useState<number>(sget('memory.retentionDays', MEMORY_DEFAULTS.retentionDays));
  const [checkpointLimit, setCkptS]        = useState<number>(sget('memory.checkpointLimit', MEMORY_DEFAULTS.checkpointLimit));
  const [autoCheckpoint, setAutoCkptS]     = useState<boolean>(sget('memory.autoCheckpoint', MEMORY_DEFAULTS.autoCheckpoint));
  const [semanticSearch, setSemanticS]     = useState<boolean>(sget('memory.semanticSearch', MEMORY_DEFAULTS.semanticSearch));
  const [confirmClear, setConfirmClear]    = useState<boolean>(false);
  const [cleared, setCleared]              = useState<string>('');

  useEffect(() => {
    setProviderS(sget('memory.provider', MEMORY_DEFAULTS.provider));
    setCtxS(sget('memory.contextTokens', MEMORY_DEFAULTS.contextTokens));
    setRetentionS(sget('memory.retentionDays', MEMORY_DEFAULTS.retentionDays));
    setCkptS(sget('memory.checkpointLimit', MEMORY_DEFAULTS.checkpointLimit));
    setAutoCkptS(sget('memory.autoCheckpoint', MEMORY_DEFAULTS.autoCheckpoint));
    setSemanticS(sget('memory.semanticSearch', MEMORY_DEFAULTS.semanticSearch));
    setCleared('');
    setConfirmClear(false);
  }, [props.resetToken]);

  const setProvider = (v: string) => { setProviderS(v); sset('memory.provider', v); };
  const setCtx = (v: number) => { setCtxS(v); sset('memory.contextTokens', v); };
  const setRetention = (v: number) => { setRetentionS(v); sset('memory.retentionDays', v); };
  const setCkpt = (v: number) => { setCkptS(v); sset('memory.checkpointLimit', v); };
  const setAutoCkpt = (v: boolean) => { setAutoCkptS(v); sset('memory.autoCheckpoint', v); };
  const setSemantic = (v: boolean) => { setSemanticS(v); sset('memory.semanticSearch', v); };

  function doClear() {
    sdel('memory.transcript');
    sdel('memory.checkpoints');
    sdel('memory.semantic-index');
    setConfirmClear(false);
    setCleared('Memory cleared.');
  }

  function doReset() {
    setProvider(MEMORY_DEFAULTS.provider);
    setCtx(MEMORY_DEFAULTS.contextTokens);
    setRetention(MEMORY_DEFAULTS.retentionDays);
    setCkpt(MEMORY_DEFAULTS.checkpointLimit);
    setAutoCkpt(MEMORY_DEFAULTS.autoCheckpoint);
    setSemantic(MEMORY_DEFAULTS.semanticSearch);
  }

  const q = (props.query || '').toLowerCase();
  const match = (kw: string) => !q || kw.toLowerCase().indexOf(q) >= 0;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Memory" description="Context depth, checkpoints, and stored transcripts." onReset={doReset} />

      {match('memory provider backend local sqlite session') ? (
        <SettingRow title="Memory provider" description="Where chat transcripts and embeddings are stored.">
          <PillSelect value={provider} onChange={setProvider} options={[
            { value: 'local',   label: 'Local file', color: COLORS.green },
            { value: 'sqlite',  label: 'SQLite',     color: COLORS.blue  },
            { value: 'session', label: 'Session',    color: COLORS.purple },
          ]} />
        </SettingRow>
      ) : null}

      {match('context size tokens window') ? (
        <SettingRow title="Context tokens" description="Soft cap for conversation tokens sent to the model (1K–256K).">
          <Stepper value={Math.round(contextTokens / 1000)} onChange={(v) => setCtx(v * 1000)} min={1} max={256} step={1} suffix="K" />
        </SettingRow>
      ) : null}

      {match('retention days age history') ? (
        <SettingRow title="Retention" description="How long transcripts are kept before they auto-prune.">
          <Stepper value={retentionDays} onChange={setRetention} min={1} max={365} step={1} suffix="d" />
        </SettingRow>
      ) : null}

      {match('checkpoint limit cap history turns') ? (
        <SettingRow title="Checkpoint limit" description="Maximum number of per-turn checkpoints kept for diff review.">
          <Stepper value={checkpointLimit} onChange={setCkpt} min={5} max={500} step={5} />
        </SettingRow>
      ) : null}

      {match('auto checkpoint save on turn') ? (
        <SettingRow title="Auto-checkpoint" description="Save a diff checkpoint after every AI turn.">
          <Toggle value={autoCheckpoint} onChange={setAutoCkpt} />
        </SettingRow>
      ) : null}

      {match('semantic search embeddings') ? (
        <SettingRow title="Semantic search" description="Index project files for embedding-based search.">
          <Toggle value={semanticSearch} onChange={setSemantic} />
        </SettingRow>
      ) : null}

      {match('clear memory erase reset storage') ? (
        <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={12} color={COLORS.red} style={{ fontWeight: 'bold' }}>Clear all memory</Text>
          <Text fontSize={10} color={COLORS.textDim}>Wipes stored transcripts, checkpoints, and the semantic index. Cannot be undone.</Text>
          {confirmClear ? (
            <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.orange}>Are you sure?</Text>
              <Pressable onPress={doClear} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
                <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>Yes, clear everything</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmClear(false)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.textDim}>Cancel</Text>
              </Pressable>
            </Row>
          ) : (
            <Pressable onPress={() => setConfirmClear(true)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red, alignSelf: 'flex-start' }}>
              <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>Clear memory</Text>
            </Pressable>
          )}
          {cleared ? <Text fontSize={10} color={COLORS.green}>{cleared}</Text> : null}
        </Box>
      ) : null}
    </Col>
  );
}

interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  path: string;
}

function pluginDir(): string {
  const h: any = globalThis;
  const home = h.__env_home || '/home/siah';
  return home + '/.sweatshop/plugins';
}

function scanPlugins(): PluginDescriptor[] {
  const h: any = globalThis;
  const dir = pluginDir();
  const out: PluginDescriptor[] = [];
  try {
    if (typeof h.__fs_list_json !== 'function') return out;
    const raw = h.__fs_list_json(dir);
    const list: string[] = JSON.parse(typeof raw === 'string' ? raw : '[]');
    for (const filename of list) {
      if (!filename.endsWith('.js')) continue;
      const path = dir + '/' + filename;
      let code = '';
      try { code = typeof h.__fs_read === 'function' ? (h.__fs_read(path) || '') : ''; } catch {}
      const nameMatch = code.match(/@plugin\s+name\s+(.+)/);
      const versionMatch = code.match(/@plugin\s+version\s+(.+)/);
      out.push({
        id: filename.replace(/\.js$/, ''),
        name: nameMatch ? nameMatch[1].trim() : filename.replace(/\.js$/, ''),
        version: versionMatch ? versionMatch[1].trim() : '0.0.1',
        path,
      });
    }
  } catch {}
  return out;
}

function PluginsPanel(props: { query: string; resetToken: number }) {
  const [version, setVersion] = useState(0);
  const plugins = scanPlugins();
  const q = (props.query || '').toLowerCase();
  const filtered = q
    ? plugins.filter(p => (p.name + ' ' + p.id + ' ' + p.version).toLowerCase().indexOf(q) >= 0)
    : plugins;

  function enabledFor(id: string): boolean {
    return sget('plugins.enabled.' + id, true);
  }
  function setEnabled(id: string, on: boolean) {
    sset('plugins.enabled.' + id, on);
    setVersion(v => v + 1);
  }
  function doReset() {
    for (const p of plugins) sdel('plugins.enabled.' + p.id);
    setVersion(v => v + 1);
  }

  useEffect(() => { setVersion(v => v + 1); }, [props.resetToken]);

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Plugins" description="JS plugins loaded from ~/.sweatshop/plugins." onReset={doReset} />

      <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Plugin directory</Text>
          <Pill label={plugins.length + ' found'} color={plugins.length > 0 ? COLORS.green : COLORS.textMuted} tiny={true} />
          <Pressable onPress={() => setVersion(v => v + 1)}>
            <Pill label="rescan" color={COLORS.blue} tiny={true} />
          </Pressable>
        </Row>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{pluginDir()}</Text>
      </Box>

      {filtered.length === 0 ? (
        <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, alignItems: 'center' }}>
          <Text fontSize={11} color={COLORS.textDim}>{q ? `No plugins match "${props.query}".` : 'No plugins found. Drop a .js file into the plugin directory and restart.'}</Text>
        </Box>
      ) : null}

      {filtered.map(plugin => {
        const on = enabledFor(plugin.id);
        return (
          <Row key={plugin.id + '_' + version} style={{
            padding: 12, gap: 12, alignItems: 'center', flexWrap: 'wrap',
            borderRadius: TOKENS.radiusMd, borderWidth: 1,
            borderColor: on ? COLORS.border : COLORS.borderSoft,
            backgroundColor: on ? COLORS.panelRaised : COLORS.panelAlt,
          }}>
            <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 200, gap: 3 }}>
              <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text fontSize={12} color={on ? COLORS.textBright : COLORS.textDim} style={{ fontWeight: 'bold' }}>{plugin.name}</Text>
                <Pill label={'v' + plugin.version} color={COLORS.blue} tiny={true} />
                <Pill label={plugin.id} tiny={true} />
              </Row>
              <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{plugin.path}</Text>
            </Col>
            <Toggle value={on} onChange={(v) => setEnabled(plugin.id, v)} onLabel="ENABLED" offLabel="DISABLED" />
          </Row>
        );
      })}
    </Col>
  );
}

function readHostString(key: string, fallback: string): string {
  try {
    const h: any = globalThis;
    const v = h[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof h.__env_get === 'function') {
      const env = h.__env_get(key);
      if (typeof env === 'string' && env.length > 0) return env;
    }
  } catch {}
  return fallback;
}

function AboutPanel(props: { query: string }) {
  const version    = readHostString('__app_version', 'dev');
  const buildSha   = readHostString('__app_build_sha', 'unknown');
  const buildTime  = readHostString('__app_build_time', 'unknown');
  const platform   = readHostString('__env_platform', 'unknown');
  const runtime    = readHostString('__runtime_name', 'jsrt');
  const reactVer   = readHostString('__react_version', '18');
  const esbuildVer = readHostString('__esbuild_version', 'bundled');
  const home       = readHostString('__env_home', '/home/siah');

  const rows: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'Version',       value: version,    tone: COLORS.blue },
    { label: 'Build SHA',     value: buildSha,   tone: COLORS.green },
    { label: 'Built',         value: buildTime },
    { label: 'Platform',      value: platform },
    { label: 'Runtime',       value: runtime,    tone: COLORS.purple },
    { label: 'React',         value: reactVer },
    { label: 'esbuild',       value: esbuildVer },
    { label: 'Home',          value: home },
  ];

  const capabilities: Array<{ name: string; present: boolean }> = [
    { name: '__store_*',      present: typeof (globalThis as any).__store_get === 'function' },
    { name: '__fs_*',         present: typeof (globalThis as any).__fs_read === 'function' },
    { name: '__exec_async',   present: typeof (globalThis as any).__exec_async === 'function' },
    { name: '__claude_*',     present: typeof (globalThis as any).__claude_init === 'function' },
    { name: '__kimi_*',       present: typeof (globalThis as any).__kimi_init === 'function' },
    { name: '__localai_*',    present: typeof (globalThis as any).__localai_init === 'function' },
  ];

  const q = (props.query || '').toLowerCase();
  const rowsFiltered = q ? rows.filter(r => (r.label + ' ' + r.value).toLowerCase().indexOf(q) >= 0) : rows;
  const capsFiltered = q ? capabilities.filter(c => c.name.toLowerCase().indexOf(q) >= 0) : capabilities;

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="About" description="Version, build info, and detected host capabilities." />

      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>sweatshop</Text>
        <Text fontSize={10} color={COLORS.textDim}>A React-native-feel IDE surface running on the JSRT runtime.</Text>
        <Col style={{ gap: 4 }}>
          {rowsFiltered.map(r => (
            <Row key={r.label} style={{ alignItems: 'center', gap: 10 }}>
              <Text fontSize={10} color={COLORS.textDim} style={{ width: 90 }}>{r.label}</Text>
              <Text fontSize={11} color={r.tone || COLORS.text} style={{ fontFamily: 'monospace' }}>{r.value}</Text>
            </Row>
          ))}
        </Col>
      </Box>

      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Host capabilities</Text>
        <Text fontSize={10} color={COLORS.textDim}>Detected FFI surfaces. Missing bindings simply gate the UI that needs them.</Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {capsFiltered.map(c => (
            <Pill key={c.name} label={c.name} color={c.present ? COLORS.green : COLORS.textMuted}
              borderColor={c.present ? COLORS.green : COLORS.border}
              backgroundColor={c.present ? COLORS.greenDeep : COLORS.panelAlt} tiny={true} />
          ))}
        </Row>
      </Box>

      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Links</Text>
        <Text fontSize={10} color={COLORS.textDim}>Report issues via the in-app feedback command in the palette.</Text>
      </Box>
    </Col>
  );
}

// ── CLI / local-endpoint backends ────────────────────────────────────────────
// Mirrors the backend routing used by cart/cockpit/index.tsx so settings can
// configure and status-check the same host FFI surfaces used at runtime.

type BackendKind = 'api' | 'cli' | 'local';

interface BackendEntry {
  id: string;
  label: string;
  kind: BackendKind;
  tone: string;
  description: string;
  hostFns: string[];
  defaults: Record<string, any>;
}

const BACKEND_ENTRIES: BackendEntry[] = [
  {
    id: 'claude-api',
    label: 'Claude API',
    kind: 'api',
    tone: COLORS.orange,
    description: 'Direct HTTP calls to the Anthropic messages API.',
    hostFns: ['__fetch_async'],
    defaults: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-opus-4-7' },
  },
  {
    id: 'claude-cli',
    label: 'Claude Code CLI',
    kind: 'cli',
    tone: COLORS.orange,
    description: 'Local Claude Code CLI bridged through __claude_init/send/poll.',
    hostFns: ['__claude_init', '__claude_send', '__claude_poll', '__claude_close'],
    defaults: { cliPath: 'claude', defaultModel: 'claude-opus-4-7', workingDir: '' },
  },
  {
    id: 'codex-cli',
    label: 'OpenAI Codex CLI',
    kind: 'cli',
    tone: COLORS.blue,
    description: 'Codex CLI bridged through the local-ai channel (__localai_*).',
    hostFns: ['__localai_init', '__localai_send', '__localai_poll', '__localai_close'],
    defaults: { cliPath: 'codex', defaultModel: 'codex', workingDir: '' },
  },
  {
    id: 'kimi-cli',
    label: 'Kimi CLI',
    kind: 'cli',
    tone: COLORS.purple,
    description: 'Kimi Code CLI bridged through __kimi_init/send/poll.',
    hostFns: ['__kimi_init', '__kimi_send', '__kimi_poll', '__kimi_close'],
    defaults: { cliPath: 'kimi-code', defaultModel: 'kimi-code/kimi-for-coding', workingDir: '' },
  },
];

interface LocalEndpoint {
  id: string;
  label: string;
  url: string;
  kind: 'ollama' | 'lmstudio' | 'openai-compatible';
}

const LOCAL_ENDPOINTS_KNOWN: LocalEndpoint[] = [
  { id: 'ollama',   label: 'Ollama',    url: 'http://127.0.0.1:11434', kind: 'ollama' },
  { id: 'lmstudio', label: 'LM Studio', url: 'http://127.0.0.1:1234',  kind: 'lmstudio' },
  { id: 'llamacpp', label: 'llama.cpp', url: 'http://127.0.0.1:8080',  kind: 'openai-compatible' },
  { id: 'vllm',     label: 'vLLM',      url: 'http://127.0.0.1:8000',  kind: 'openai-compatible' },
];

function hostHasAll(fns: string[]): boolean {
  const h: any = globalThis;
  for (const name of fns) {
    if (typeof h[name] !== 'function') return false;
  }
  return true;
}

// Known model catalogs per backend. Sourced from cart/sweatshop/providers.ts
// (Claude API + Claude CLI share the Anthropic set) and cart/cockpit/index.tsx
// (Kimi, Codex/local backends). Codex entries are augmented at runtime via
// the local endpoint scanner below, so the dropdown shows both hardcoded
// hosted models and whatever an Ollama / LM Studio instance is serving.

interface ModelOption { id: string; label: string; note?: string }

const MODEL_CATALOG: Record<string, ModelOption[]> = {
  'claude-api': [
    { id: 'claude-opus-4-7',    label: 'Claude Opus 4.7',      note: '200k · $15/$75' },
    { id: 'claude-opus-4-7-1m', label: 'Claude Opus 4.7 [1M]', note: '1M · $15/$75' },
    { id: 'claude-opus-4-6',    label: 'Claude Opus 4.6',      note: '200k · $15/$75' },
    { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6',    note: '200k · $3/$15' },
    { id: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5',    note: '200k · $3/$15' },
    { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5',     note: '200k · $1/$5' },
  ],
  'claude-cli': [
    { id: 'claude-opus-4-7',    label: 'Claude Opus 4.7' },
    { id: 'claude-opus-4-7-1m', label: 'Claude Opus 4.7 [1M]' },
    { id: 'claude-opus-4-6',    label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6' },
    { id: 'claude-sonnet-4-5',  label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5' },
  ],
  'codex-cli': [
    { id: 'gpt-5-codex',        label: 'GPT-5 Codex',          note: '400k · code' },
    { id: 'gpt-5.4',            label: 'GPT-5.4',              note: '400k' },
    { id: 'gpt-5.4-mini',       label: 'GPT-5.4 mini',         note: '400k · fast' },
    { id: 'codex',              label: 'Codex (legacy)' },
    { id: 'gemini-2.5-pro',     label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash',   label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
  'kimi-cli': [
    { id: 'kimi-code/kimi-for-coding', label: 'Kimi for Coding', note: '256k · code' },
    { id: 'kimi-k2.5',                 label: 'Kimi K2.5',       note: '256k' },
    { id: 'kimi-k2',                   label: 'Kimi K2',         note: '256k' },
    { id: 'kimi-k2-thinking',          label: 'Kimi K2 Thinking',note: '256k · reason' },
  ],
};

// Probe local endpoints for served models. Ollama exposes /api/tags with a
// `models[].name` shape; OpenAI-compatible servers (LM Studio, llama.cpp,
// vLLM) expose /v1/models with an `data[].id` shape. Results are merged,
// deduplicated, and tagged with their endpoint label so the picker can
// indicate origin.
async function scanLocalModels(): Promise<ModelOption[]> {
  const h: any = globalThis;
  const out: ModelOption[] = [];
  const seen = new Set<string>();
  if (typeof h.__fetch_async !== 'function') return out;

  const customs: LocalEndpoint[] = sget('providers.local.custom', [] as LocalEndpoint[]);
  const endpoints = LOCAL_ENDPOINTS_KNOWN.concat(customs);

  for (const ep of endpoints) {
    const url = ep.kind === 'ollama' ? ep.url + '/api/tags' : ep.url + '/v1/models';
    let res: any = null;
    try { res = await h.__fetch_async(url, { method: 'GET', timeoutMs: 1500 }); } catch { res = null; }
    if (!res || !res.body) continue;
    let parsed: any = null;
    try { parsed = typeof res.body === 'string' ? JSON.parse(res.body) : res.body; } catch { continue; }
    const raw = ep.kind === 'ollama'
      ? (parsed && Array.isArray(parsed.models) ? parsed.models : [])
      : (parsed && Array.isArray(parsed.data)   ? parsed.data   : []);
    for (const m of raw) {
      const id = ep.kind === 'ollama' ? String(m.name || '') : String(m.id || '');
      if (!id) continue;
      const tagged = ep.id + ':' + id;
      if (seen.has(tagged)) continue;
      seen.add(tagged);
      out.push({ id, label: id, note: ep.label });
    }
  }
  return out;
}

function ModelDropdown(props: {
  value: string;
  options: ModelOption[];
  onChange: (id: string) => void;
  discovered?: ModelOption[];
  onRefreshDiscovered?: () => void;
  refreshing?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [custom, setCustom] = useState(false);
  const combined: ModelOption[] = [];
  const seen = new Set<string>();
  for (const opt of (props.options || [])) {
    if (seen.has(opt.id)) continue;
    seen.add(opt.id);
    combined.push(opt);
  }
  for (const opt of (props.discovered || [])) {
    if (seen.has(opt.id)) continue;
    seen.add(opt.id);
    combined.push(opt);
  }
  const current = combined.find(o => o.id === props.value);
  const knownId = !!current;
  const displayLabel = current ? current.label : (props.value || props.placeholder || 'select a model…');

  return (
    <Col style={{ gap: 6, position: 'relative', zIndex: open ? 9999 : 0, overflow: 'visible' }}>
      <Box style={{ position: 'relative', zIndex: open ? 9999 : 0, overflow: 'visible' }}>
        <Pressable onPress={() => setOpen(!open)} style={{
          padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: knownId ? COLORS.border : (props.value ? COLORS.orange : COLORS.border),
          backgroundColor: COLORS.panelBg, gap: 8,
        }}>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Col style={{ flexGrow: 1, flexBasis: 0, gap: 1 }}>
              <Text fontSize={11} color={COLORS.text} style={{ fontFamily: 'monospace' }}>{displayLabel}</Text>
              {current && current.note ? <Text fontSize={9} color={COLORS.textDim}>{current.note}</Text> : null}
              {!knownId && props.value ? <Text fontSize={9} color={COLORS.orange}>custom · {props.value}</Text> : null}
            </Col>
            <Text fontSize={10} color={COLORS.textDim}>{open ? '▲' : '▼'}</Text>
          </Row>
        </Pressable>
        {open ? (
          <Col style={{
            position: 'absolute', left: 0, right: 0, top: 40,
            gap: 4, padding: 6, maxHeight: 260, overflow: 'scroll', zIndex: 10000,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.panelRaised,
          }}>
            {combined.length === 0 ? (
              <Text fontSize={10} color={COLORS.textDim}>No models available.</Text>
            ) : null}
            {combined.map(opt => {
              const active = opt.id === props.value;
              return (
                <Pressable key={opt.id} onPress={() => { props.onChange(opt.id); setCustom(false); setOpen(false); }} style={{
                  padding: 8, borderRadius: TOKENS.radiusSm,
                  borderWidth: 1, borderColor: active ? COLORS.blue : 'transparent',
                  backgroundColor: active ? COLORS.panelHover : COLORS.panelBg,
                }}>
                  <Row style={{ alignItems: 'center', gap: 6 }}>
                    <Col style={{ flexGrow: 1, flexBasis: 0, gap: 1 }}>
                      <Text fontSize={11} color={active ? COLORS.blue : COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: active ? 'bold' : 'normal' }}>{opt.label}</Text>
                      {opt.note ? <Text fontSize={9} color={COLORS.textDim}>{opt.note}</Text> : null}
                    </Col>
                  </Row>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setCustom(true); setOpen(false); }} style={{
              padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={COLORS.textDim}>Custom…</Text>
            </Pressable>
          </Col>
        ) : null}
      </Box>
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {props.onRefreshDiscovered ? (
          <Pressable onPress={props.onRefreshDiscovered} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: props.refreshing ? COLORS.border : COLORS.blue,
            backgroundColor: props.refreshing ? COLORS.panelAlt : COLORS.blueDeep,
          }}>
            <Text fontSize={10} color={props.refreshing ? COLORS.textDim : COLORS.blue} style={{ fontWeight: 'bold' }}>
              {props.refreshing ? 'scanning…' : 'Refresh local models'}
            </Text>
          </Pressable>
        ) : null}
        {props.discovered && props.discovered.length > 0 ? (
          <Pill label={props.discovered.length + ' discovered'} color={COLORS.green} tiny={true} />
        ) : null}
        <Pressable onPress={() => setCustom(!custom)}>
          <Text fontSize={10} color={COLORS.textDim}>{custom ? 'hide custom' : 'custom…'}</Text>
        </Pressable>
      </Row>
      {custom || (!knownId && props.value) ? (
        <Col style={{ gap: 4 }}>
          <Text fontSize={9} color={COLORS.textDim}>Custom model id (advanced):</Text>
          <TextInput value={props.value} onChangeText={props.onChange}
            placeholder={props.placeholder || 'e.g. my-org/my-model'}
            style={{ height: 28, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
        </Col>
      ) : null}
    </Col>
  );
}

function BackendCard(props: { entry: BackendEntry; enabled: boolean; onToggle: () => void; version: number }) {
  const e = props.entry;
  const reachable = hostHasAll(e.hostFns);
  const [draftCli, setDraftCli]   = useState<string>(sget('providers.' + e.id + '.cliPath',     e.defaults.cliPath     || ''));
  const [draftUrl, setDraftUrl]   = useState<string>(sget('providers.' + e.id + '.baseUrl',     e.defaults.baseUrl     || ''));
  const [draftModel, setDraftMod] = useState<string>(sget('providers.' + e.id + '.defaultModel', e.defaults.defaultModel || ''));
  const [draftDir, setDraftDir]   = useState<string>(sget('providers.' + e.id + '.workingDir',  e.defaults.workingDir  || ''));
  const [discovered, setDiscovered] = useState<ModelOption[]>(sget('providers.' + e.id + '.discovered', [] as ModelOption[]));
  const [scanning, setScanning]     = useState<boolean>(false);

  useEffect(() => {
    setDraftCli(sget('providers.' + e.id + '.cliPath', e.defaults.cliPath || ''));
    setDraftUrl(sget('providers.' + e.id + '.baseUrl', e.defaults.baseUrl || ''));
    setDraftMod(sget('providers.' + e.id + '.defaultModel', e.defaults.defaultModel || ''));
    setDraftDir(sget('providers.' + e.id + '.workingDir', e.defaults.workingDir || ''));
    setDiscovered(sget('providers.' + e.id + '.discovered', [] as ModelOption[]));
  }, [props.version]);

  function save(field: string, value: string) { sset('providers.' + e.id + '.' + field, value); }
  function setModel(id: string) { setDraftMod(id); save('defaultModel', id); }

  async function refreshDiscovered() {
    setScanning(true);
    const found = await scanLocalModels();
    setDiscovered(found);
    sset('providers.' + e.id + '.discovered', found);
    setScanning(false);
  }

  const catalog: ModelOption[] = MODEL_CATALOG[e.id] || [];
  // The codex/local backend is the one the user explicitly asked to be able
  // to populate from Ollama / LM Studio. Other backends talk to named
  // services — exposing a refresh button there would mislead, so keep it
  // codex-only.
  const supportsDiscovery = e.id === 'codex-cli';

  return (
    <Box style={{
      padding: 12, gap: 10,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.enabled ? e.tone : COLORS.border,
      backgroundColor: props.enabled ? COLORS.panelHover : COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{e.label}</Text>
        <Pill label={e.kind.toUpperCase()} color={e.tone} tiny={true} />
        <Pill label={reachable ? 'bound' : 'missing'} color={reachable ? COLORS.green : COLORS.red} tiny={true} />
        <Box style={{ flexGrow: 1 }} />
        <Toggle value={props.enabled} onChange={() => props.onToggle()} />
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{e.description}</Text>

      {e.kind === 'api' ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>Base URL</Text>
          <TextInput value={draftUrl} onChangeText={(v: string) => { setDraftUrl(v); save('baseUrl', v); }}
            placeholder={e.defaults.baseUrl}
            style={{ height: 30, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
        </Col>
      ) : null}

      {e.kind === 'cli' ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>CLI path</Text>
          <TextInput value={draftCli} onChangeText={(v: string) => { setDraftCli(v); save('cliPath', v); }}
            placeholder={e.defaults.cliPath}
            style={{ height: 30, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          <Text fontSize={10} color={COLORS.textDim}>Working directory (optional)</Text>
          <TextInput value={draftDir} onChangeText={(v: string) => { setDraftDir(v); save('workingDir', v); }}
            placeholder="cwd for CLI invocations"
            style={{ height: 30, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
        </Col>
      ) : null}

      <Col style={{ gap: 4 }}>
        <Text fontSize={10} color={COLORS.textDim}>Default model</Text>
        <ModelDropdown value={draftModel} options={catalog}
          discovered={supportsDiscovery ? discovered : undefined}
          onRefreshDiscovered={supportsDiscovery ? refreshDiscovered : undefined}
          refreshing={scanning}
          onChange={setModel}
          placeholder={e.defaults.defaultModel} />
      </Col>

      <Row style={{ gap: 4, flexWrap: 'wrap' }}>
        {e.hostFns.map(fn => (
          <Text key={fn} fontSize={9} color={(globalThis as any)[fn] ? COLORS.green : COLORS.textMuted} style={{ fontFamily: 'monospace' }}>{fn}</Text>
        ))}
      </Row>
    </Box>
  );
}

function LocalEndpointsSection(props: { query: string; version: number; onBump: () => void }) {
  const [scanning, setScanning]       = useState<boolean>(false);
  const [statuses, setStatusesS]      = useState<Record<string, string>>(sget('providers.local.statuses', {} as Record<string, string>));
  const [customUrl, setCustomUrl]     = useState<string>('');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [customs, setCustomsS]        = useState<LocalEndpoint[]>(sget('providers.local.custom', [] as LocalEndpoint[]));

  useEffect(() => {
    setStatusesS(sget('providers.local.statuses', {} as Record<string, string>));
    setCustomsS(sget('providers.local.custom', [] as LocalEndpoint[]));
  }, [props.version]);

  function setStatuses(next: Record<string, string>) {
    setStatusesS(next);
    sset('providers.local.statuses', next);
  }
  function setCustoms(next: LocalEndpoint[]) {
    setCustomsS(next);
    sset('providers.local.custom', next);
  }

  async function probe(endpoint: LocalEndpoint): Promise<string> {
    const h: any = globalThis;
    if (typeof h.__fetch_async !== 'function') return 'no __fetch_async';
    try {
      const probeUrl = endpoint.kind === 'ollama'
        ? endpoint.url + '/api/tags'
        : endpoint.url + '/v1/models';
      const res = await h.__fetch_async(probeUrl, { method: 'GET', timeoutMs: 1500 });
      if (!res) return 'no response';
      if (res.status && res.status >= 200 && res.status < 500) return 'up (' + res.status + ')';
      return 'status ' + (res.status || '?');
    } catch (err: any) {
      return 'down';
    }
  }

  async function scanAll() {
    setScanning(true);
    const next: Record<string, string> = {};
    const all = LOCAL_ENDPOINTS_KNOWN.concat(customs);
    for (const ep of all) {
      next[ep.id] = await probe(ep);
    }
    setStatuses(next);
    setScanning(false);
    props.onBump();
  }

  function addCustom() {
    const url = customUrl.trim();
    if (!url) return;
    const id = 'custom-' + Date.now().toString(36);
    const next = customs.concat([{ id, label: customLabel.trim() || url, url, kind: 'openai-compatible' }]);
    setCustoms(next);
    setCustomUrl('');
    setCustomLabel('');
  }
  function removeCustom(id: string) {
    setCustoms(customs.filter(c => c.id !== id));
  }

  const q = (props.query || '').toLowerCase();
  const all = LOCAL_ENDPOINTS_KNOWN.concat(customs);
  const filtered = q ? all.filter(ep => (ep.label + ' ' + ep.url + ' ' + ep.kind).toLowerCase().indexOf(q) >= 0) : all;

  return (
    <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Local endpoints</Text>
        <Pill label={LOCAL_ENDPOINTS_KNOWN.length + customs.length + ' known'} tiny={true} />
        <Pressable onPress={scanAll} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: scanning ? COLORS.panelAlt : COLORS.blueDeep, borderWidth: 1, borderColor: scanning ? COLORS.border : COLORS.blue }}>
          <Text fontSize={10} color={scanning ? COLORS.textDim : COLORS.blue} style={{ fontWeight: 'bold' }}>{scanning ? 'scanning…' : 'Scan now'}</Text>
        </Pressable>
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>Probes known localhost ports for Ollama, LM Studio, and OpenAI-compatible servers. Uses __fetch_async with a short timeout.</Text>
      <Col style={{ gap: 6 }}>
        {filtered.map(ep => {
          const status = statuses[ep.id] || 'unknown';
          const up = status.indexOf('up') === 0;
          const isCustom = customs.some(c => c.id === ep.id);
          return (
            <Row key={ep.id} style={{ alignItems: 'center', gap: 8, padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, flexWrap: 'wrap' }}>
              <Pill label={up ? '●' : '○'} color={up ? COLORS.green : COLORS.textMuted} tiny={true} />
              <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 180, gap: 1 }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{ep.label}</Text>
                <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{ep.url} · {ep.kind}</Text>
              </Col>
              <Text fontSize={10} color={up ? COLORS.green : COLORS.textDim}>{status}</Text>
              {isCustom ? (
                <Pressable onPress={() => removeCustom(ep.id)}><Text fontSize={10} color={COLORS.red}>remove</Text></Pressable>
              ) : null}
            </Row>
          );
        })}
      </Col>
      <Col style={{ gap: 6 }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Add custom endpoint</Text>
        <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextInput value={customLabel} onChangeText={setCustomLabel} placeholder="Label (e.g. My server)"
            style={{ flexGrow: 1, flexBasis: 140, flexShrink: 1, height: 30, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg }} />
          <TextInput value={customUrl} onChangeText={setCustomUrl} placeholder="http://host:port"
            style={{ flexGrow: 1, flexBasis: 180, flexShrink: 1, height: 30, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          <Pressable onPress={addCustom} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Add</Text>
          </Pressable>
        </Row>
      </Col>
    </Box>
  );
}

function BackendsSection(props: { query: string; version: number; onBump: () => void }) {
  const q = (props.query || '').toLowerCase();
  const filtered = q
    ? BACKEND_ENTRIES.filter(e => (e.label + ' ' + e.id + ' ' + e.kind + ' ' + e.description).toLowerCase().indexOf(q) >= 0)
    : BACKEND_ENTRIES;

  function enabledFor(id: string): boolean {
    return sget('providers.' + id + '.enabled', true);
  }
  function toggle(id: string) {
    sset('providers.' + id + '.enabled', !enabledFor(id));
    props.onBump();
  }

  return (
    <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Backends</Text>
        <Pill label="API + CLI" tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>Each backend routes through a different host FFI surface. CLI backends map to the same __claude_*, __kimi_*, __localai_* bridges used by the cockpit cart, so disabling one here also disables it for any caller that defers to these settings.</Text>
      {filtered.length === 0 ? (
        <Text fontSize={10} color={COLORS.textDim}>No backends match "{props.query}".</Text>
      ) : null}
      {filtered.map(entry => (
        <BackendCard key={entry.id + '_' + props.version} entry={entry} enabled={enabledFor(entry.id)} onToggle={() => toggle(entry.id)} version={props.version} />
      ))}
    </Box>
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
        <Box style={{ padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{display}</Text>
        </Box>
      ) : null}
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={stored ? 'Replace key…' : 'Paste provider key…'}
          style={{ flexGrow: 1, flexBasis: 180, flexShrink: 1, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
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

  function doReset() {
    for (const entry of BACKEND_ENTRIES) {
      sdel('providers.' + entry.id + '.enabled');
      sdel('providers.' + entry.id + '.cliPath');
      sdel('providers.' + entry.id + '.baseUrl');
      sdel('providers.' + entry.id + '.defaultModel');
      sdel('providers.' + entry.id + '.workingDir');
    }
    sdel('providers.local.statuses');
    sdel('providers.local.custom');
    setKeyVersion(v => v + 1);
  }

  return (
    <Col style={{ gap: 14 }}>
      <SectionTitle title="Providers" description="Backends (API + CLI), local endpoints, and fallback HTTP providers." onReset={doReset} />
      <BackendsSection query={props.query} version={keyVersion} onBump={() => setKeyVersion(v => v + 1)} />
      <LocalEndpointsSection query={props.query} version={keyVersion} onBump={() => setKeyVersion(v => v + 1)} />
      <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>HTTP providers</Text>
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
  const sections = SETTINGS_SECTIONS;
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

  function renderPanel(section: SectionId) {
    if (section === 'appearance')  return <AppearancePanel query={query} resetToken={resetToken} />;
    if (section === 'editor')      return <EditorPanel query={query} resetToken={resetToken} />;
    if (section === 'scrolling')   return <ScrollingPanel query={query} resetToken={resetToken} />;
    if (section === 'terminal')    return <TerminalSettingsPanel query={query} resetToken={resetToken} />;
    if (section === 'keybindings') return <KeybindEditor query={query} resetToken={resetToken} />;
    if (section === 'providers')   return <ProvidersPanel
      query={query}
      providerConfigs={props.providerConfigs || []}
      selectedProviderId={props.selectedProviderId}
      selectedModel={props.selectedModel}
      onSelectProvider={props.onSelectProvider || (() => {})}
      onToggleProvider={props.onToggleProvider || (() => {})}
      onUpdateProvider={props.onUpdateProvider || (() => {})}
      onSelectModel={props.onSelectModel || (() => {})}
    />;
    if (section === 'memory')      return <MemoryPanel query={query} resetToken={resetToken} />;
    if (section === 'plugins')     return <PluginsPanel query={query} resetToken={resetToken} />;
    return <AboutPanel query={query} />;
  }

  const trimmedQuery = query.trim();
  const searchResults = trimmedQuery ? searchSettingsIndex(trimmedQuery) : [];

  return (
    <ScrollView showScrollbar={true} style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
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
          <SettingsSearchInput query={query} onQueryChange={setQuery} />
        </Box>

        {trimmedQuery ? (
          <SettingsSearchResults
            query={trimmedQuery}
            results={searchResults}
            activeSection={active}
            onOpenSection={selectSection}
            onClearQuery={() => setQuery('')}
          />
        ) : (
          <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
            <Col style={{ width: stacked ? '100%' : 240, gap: 8 }}>
              {sections.map(section => (
                <NavRow key={section.id} section={section} active={section.id === active}
                  matchCount={countSettingsSectionMatches(section.id, query)}
                  onSelect={selectSection} />
              ))}
            </Col>
            <Col style={{ flexGrow: 1, flexBasis: 0, gap: 14 }}>
              <PageModeTransition
                mode={active}
                durationMs={180}
                style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}
                renderPage={(mode) => renderPanel(mode as SectionId)}
              />
            </Col>
          </Box>
        )}
      </Col>
    </ScrollView>
  );
}
