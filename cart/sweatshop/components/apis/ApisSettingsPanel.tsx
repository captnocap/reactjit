const React: any = require('react');
const { useState, useCallback } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { builtinServices, type ServiceDefinition, type ServiceCategory } from '../../lib/apis/registry';
import { useServiceKey, setServiceKey, deleteServiceKey, isServiceEnabled } from '../../lib/apis/useServiceKey';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  media: 'Media & Entertainment',
  dev: 'Development & Data',
  ai: 'AI & LLMs',
  'smart-home': 'Smart Home',
  productivity: 'Productivity',
  finance: 'Finance',
  social: 'Social & Weather',
  custom: 'Custom',
};

const CATEGORY_ORDER: ServiceCategory[] = ['ai', 'dev', 'media', 'productivity', 'smart-home', 'finance', 'social', 'custom'];

function ServiceCard({ svc }: { svc: ServiceDefinition }) {
  const [enabled, setEnabled] = useState(isServiceEnabled(svc.id));
  const keys = useServiceKey(svc.id);
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of svc.auth.fields) out[f.key] = keys[f.key] || '';
    return out;
  });
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(() => {
    if (enabled) {
      deleteServiceKey(svc.id);
      setEnabled(false);
    } else {
      setEnabled(true);
    }
  }, [enabled, svc.id]);

  const save = useCallback(() => {
    setSaving(true);
    const data: Record<string, string> = {};
    for (const f of svc.auth.fields) data[f.key] = local[f.key] || '';
    setServiceKey(svc.id, data);
    setTimeout(() => setSaving(false), 400);
  }, [local, svc.id]);

  const docs = svc.docsUrl ? () => {
    try { (globalThis as any).__openExternal?.(svc.docsUrl); } catch {}
  } : undefined;

  return (
    <Box style={{
      borderWidth: 1,
      borderColor: enabled ? COLORS.accent : COLORS.border,
      borderRadius: TOKENS.radius,
      padding: 12,
      marginBottom: 8,
      backgroundColor: enabled ? `${COLORS.accent}10` : 'transparent',
    }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: COLORS.fg }}>{svc.name}</Text>
          <Text style={{ fontSize: 10, color: COLORS.fgSecondary, textTransform: 'uppercase' }}>{svc.auth.type}</Text>
        </Row>
        <Pressable onClick={toggle} style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: TOKENS.radius,
          backgroundColor: enabled ? COLORS.green + '30' : COLORS.fgSecondary + '20',
        }}>
          <Text style={{ fontSize: 11, color: enabled ? COLORS.green : COLORS.fgSecondary, fontWeight: '600' }}>
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </Row>

      {svc.auth.fields.map(field => (
        <Row key={field.key} style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ width: 120, fontSize: 12, color: COLORS.fgSecondary }}>{field.label}</Text>
          <TextInput
            style={{
              flex: 1,
              fontSize: 12,
              color: COLORS.fg,
              backgroundColor: COLORS.panel,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: TOKENS.radius,
              padding: 6,
            }}
            value={local[field.key] || ''}
            onChange={(v: string) => setLocal(prev => ({ ...prev, [field.key]: v }))}
            placeholder={field.placeholder}
            secureTextEntry={field.secret}
          />
        </Row>
      ))}

      <Row style={{ justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        {docs && (
          <Pressable onClick={docs} style={{ padding: 4 }}>
            <Text style={{ fontSize: 11, color: COLORS.accent }}>Docs</Text>
          </Pressable>
        )}
        <Pressable onClick={save} style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: TOKENS.radius,
          backgroundColor: COLORS.accent + '20',
        }}>
          <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: '600' }}>
            {saving ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </Row>
    </Box>
  );
}

export function ApisSettingsPanel() {
  const byCategory: Record<string, ServiceDefinition[]> = {};
  for (const svc of builtinServices) {
    if (!byCategory[svc.category]) byCategory[svc.category] = [];
    byCategory[svc.category].push(svc);
  }

  return (
    <Col style={{ flex: 1, backgroundColor: COLORS.bg, padding: 12 }}>
      <Row style={{ marginBottom: 12, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.fg }}>API Integrations</Text>
        <Text style={{ fontSize: 12, color: COLORS.fgSecondary }}>{builtinServices.length} services</Text>
      </Row>
      <ScrollView style={{ flex: 1 }}>
        {CATEGORY_ORDER.map(cat => {
          const list = byCategory[cat];
          if (!list || list.length === 0) return null;
          return (
            <Box key={cat} style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '700',
                color: COLORS.fgSecondary,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
              }}>
                {CATEGORY_LABELS[cat] || cat}
              </Text>
              {list.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
            </Box>
          );
        })}
      </ScrollView>
    </Col>
  );
}
