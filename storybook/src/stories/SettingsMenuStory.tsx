import React, { useState, useEffect } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import {
  builtinServices,
  useSettingsRegistry,
  useServiceKey,
  type ServiceDefinition,
  type ServiceCategory,
} from '../../../packages/apis/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Category colors ──────────────────────────────────────

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  ai: '#a78bfa',
  media: '#34d399',
  dev: '#60a5fa',
  'smart-home': '#f59e0b',
  productivity: '#f472b6',
  finance: '#38bdf8',
  social: '#fb923c',
  custom: '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  media: 'Media',
  dev: 'Dev',
  'smart-home': 'Home',
  productivity: 'Prod',
  finance: 'Finance',
  social: 'Social',
  custom: 'Custom',
};

// ── Service Card ─────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceDefinition }) {
  const c = useThemeColors();
  const catColor = CATEGORY_COLORS[service.category] || '#94a3b8';

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 6,
      padding: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      width: 220,
    }}>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{
          backgroundColor: catColor,
          borderRadius: 3,
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
          <Text style={{ fontSize: 8, color: '#000', fontWeight: '700' }}>
            {CATEGORY_LABELS[service.category] || service.category}
          </Text>
        </Box>
        <Text style={{ fontSize: 12, color: c.text, fontWeight: '600' }}>
          {service.name}
        </Text>
      </Box>

      <Text style={{ fontSize: 9, color: c.textDim }}>
        {`Auth: ${service.auth.type}`}
      </Text>

      {service.auth.fields.map((field, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: c.textDim,
          }} />
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {field.label}
          </Text>
          {field.secret === false && (
            <Text style={{ fontSize: 8, color: c.textDim }}>(visible)</Text>
          )}
        </Box>
      ))}

      {service.docsUrl && (
        <Text style={{ fontSize: 8, color: c.accent }}>
          {service.docsUrl.replace('https://', '').split('/').slice(0, 2).join('/')}
        </Text>
      )}
    </Box>
  );
}

// ── Registry Overview ────────────────────────────────────

function RegistryOverview() {
  const c = useThemeColors();

  const categories = new Map<string, ServiceDefinition[]>();
  for (const svc of builtinServices) {
    const cat = svc.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(svc);
  }

  return (
    <Box style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, color: c.text, fontWeight: '700' }}>
        Service Registry
      </Text>
      <Text style={{ fontSize: 10, color: c.textSecondary }}>
        {`${builtinServices.length} built-in services. Press F10 to open the settings overlay.`}
      </Text>

      {Array.from(categories.entries()).map(([cat, services]) => (
        <Box key={cat} style={{ gap: 6 }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: CATEGORY_COLORS[cat as ServiceCategory] || '#94a3b8',
            }} />
            <Text style={{ fontSize: 12, color: c.text, fontWeight: '600' }}>
              {CATEGORY_LABELS[cat] || cat}
            </Text>
            <Text style={{ fontSize: 10, color: c.textDim }}>
              {`(${services.length})`}
            </Text>
          </Box>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {services.map(svc => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Custom Service Demo ──────────────────────────────────

function CustomServiceDemo() {
  const c = useThemeColors();

  const customService: ServiceDefinition = {
    id: 'my-backend',
    name: 'My Backend API',
    category: 'custom',
    auth: {
      type: 'bearer',
      fields: [
        { key: 'token', label: 'API Token', placeholder: 'your-secret-token' },
        { key: 'baseUrl', label: 'Base URL', secret: false, placeholder: 'https://api.example.com' },
      ],
    },
    docsUrl: 'https://example.com/docs',
    baseUrl: 'https://api.example.com',
  };

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>
        Custom Service Definition
      </Text>
      <Text style={{ fontSize: 10, color: c.textSecondary }}>
        Same format as built-in services. Add to your registry:
      </Text>
      <Box style={{
        backgroundColor: c.bg,
        borderRadius: 4,
        padding: 8,
      }}>
        <Text style={{ fontSize: 9, color: c.textDim }}>
          {`import { builtinServices } from '@ilovereact/apis';`}
        </Text>
        <Text style={{ fontSize: 9, color: c.textDim }}>
          {`const services = [...builtinServices, myService];`}
        </Text>
        <Text style={{ fontSize: 9, color: c.textDim }}>
          {`useSettingsRegistry(services);`}
        </Text>
      </Box>
      <ServiceCard service={customService} />
    </Box>
  );
}

// ── useServiceKey Demo ───────────────────────────────────

function UseServiceKeyDemo() {
  const c = useThemeColors();
  const { key: nasaKey, loading, configured } = useServiceKey('nasa', 'apiKey');

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      padding: 12,
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>
        useServiceKey() Hook
      </Text>
      <Text style={{ fontSize: 10, color: c.textSecondary }}>
        Reads keys stored by the settings overlay:
      </Text>
      <Box style={{
        backgroundColor: c.bg,
        borderRadius: 4,
        padding: 8,
      }}>
        <Text style={{ fontSize: 9, color: c.textDim }}>
          {`const { key, configured } = useServiceKey('nasa', 'apiKey');`}
        </Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: loading ? c.textDim : (configured ? '#34d399' : '#f87171'),
        }} />
        <Text style={{ fontSize: 11, color: c.text }}>
          {loading ? 'Loading...' : (configured ? 'NASA API key configured' : 'Not configured (press F10)')}
        </Text>
      </Box>
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

export default function SettingsMenuStory() {
  const c = useThemeColors();

  // Register all built-in services with the Lua settings overlay
  useSettingsRegistry();

  return (
    <ScrollView style={{
      width: '100%',
      height: '100%',
      backgroundColor: c.bg,
    }}>
      <Box style={{ padding: 16, gap: 16, width: '100%' }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: '700' }}>
            Settings Menu
          </Text>
          <Text style={{ fontSize: 11, color: c.textSecondary }}>
            Press F10 to open the API key management overlay. Keys persist across sessions.
          </Text>
        </Box>

        <UseServiceKeyDemo />
        <CustomServiceDemo />
        <RegistryOverview />
      </Box>
    </ScrollView>
  );
}
