/**
 * SettingsView — Provider configuration, system prompt, generation params.
 *
 * Organized into cards: Providers, Generation, System Prompt.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput, Slider, ScrollView } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { ProviderConfig, AppSettings } from '../types';

// ── Section Card ─────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box style={{
      width: '100%',
      backgroundColor: V.bgAlt,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: V.borderSubtle,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 14,
      paddingBottom: 14,
      gap: 12,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

// ── Field Label ──────────────────────────────────────────

function FieldLabel({ label, description }: { label: string; description?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: c.text }}>{label}</Text>
      {description && (
        <Text style={{ fontSize: 10, color: c.textDim }}>{description}</Text>
      )}
    </Box>
  );
}

// ── Provider Card ────────────────────────────────────────

function ProviderCard({ provider, onUpdate }: {
  provider: ProviderConfig;
  onUpdate: (updated: ProviderConfig) => void;
}) {
  const c = useThemeColors();
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const baseURL = provider.baseURL.replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (provider.apiKey) headers['authorization'] = `Bearer ${provider.apiKey}`;
      const res = await fetch(`${baseURL}/v1/models`, { headers } as any);
      onUpdate({ ...provider, healthy: res.ok });
    } catch {
      onUpdate({ ...provider, healthy: false });
    }
    setTesting(false);
  };

  return (
    <Box style={{
      width: '100%',
      gap: 10,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      borderRadius: 4,
      backgroundColor: V.bgElevated,
      borderWidth: 1,
      borderColor: V.borderSubtle,
    }}>
      {/* Header: name + health dot */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>
          {provider.name}
        </Text>
        <Box style={{
          width: 8, height: 8,
          borderRadius: 9999,
          backgroundColor: provider.healthy ? V.success : V.error,
        }} />
      </Box>

      {/* Base URL */}
      <Box style={{ gap: 4 }}>
        <FieldLabel label="Base URL" />
        <TextInput
          value={provider.baseURL}
          onChangeText={(t) => onUpdate({ ...provider, baseURL: t })}
          style={{
            width: '100%',
            fontSize: 12,
            backgroundColor: V.bgInset,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: V.borderSubtle,
            paddingLeft: 8, paddingRight: 8,
            paddingTop: 5, paddingBottom: 5,
            color: c.text,
          }}
        />
      </Box>

      {/* API Key */}
      <Box style={{ gap: 4 }}>
        <FieldLabel label="API Key" description="Leave empty for local providers" />
        <TextInput
          value={provider.apiKey}
          onChangeText={(t) => onUpdate({ ...provider, apiKey: t })}
          placeholder="sk-..."
          style={{
            width: '100%',
            fontSize: 12,
            backgroundColor: V.bgInset,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: V.borderSubtle,
            paddingLeft: 8, paddingRight: 8,
            paddingTop: 5, paddingBottom: 5,
            color: c.text,
          }}
        />
      </Box>

      {/* Test button */}
      <Pressable
        onPress={testConnection}
        style={(state) => ({
          alignSelf: 'flex-start',
          paddingLeft: 12, paddingRight: 12,
          paddingTop: 5, paddingBottom: 5,
          borderRadius: 4,
          backgroundColor: state.hovered ? V.accent : V.accentSubtle,
          borderWidth: 1,
          borderColor: V.accent,
        })}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: V.accent }}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Text>
      </Pressable>
    </Box>
  );
}

// ── SettingsView ─────────────────────────────────────────

export interface SettingsViewProps {
  providers: ProviderConfig[];
  onUpdateProvider: (provider: ProviderConfig) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export function SettingsView({
  providers,
  onUpdateProvider,
  settings,
  onUpdateSettings,
}: SettingsViewProps) {
  const c = useThemeColors();

  return (
    <ScrollView style={{ flexGrow: 1, width: '100%' }}>
      <Box style={{
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 20,
        paddingBottom: 32,
        gap: 16,
      }}>
        {/* Header */}
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>
          Settings
        </Text>

        {/* Providers */}
        <Section title="Providers">
          <Box style={{ gap: 10 }}>
            {providers.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                onUpdate={onUpdateProvider}
              />
            ))}
          </Box>
        </Section>

        {/* Generation */}
        <Section title="Generation">
          <Box style={{ gap: 12 }}>
            <Box style={{ gap: 4 }}>
              <FieldLabel
                label={`Temperature: ${settings.temperature.toFixed(2)}`}
                description="Controls randomness. 0 = deterministic, 1 = creative."
              />
              <Slider
                value={settings.temperature}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => onUpdateSettings({ ...settings, temperature: v })}
                style={{ width: '100%' }}
              />
            </Box>

            <Box style={{ gap: 4 }}>
              <FieldLabel
                label={`Max Tokens: ${settings.maxTokens}`}
                description="Maximum length of the response."
              />
              <Slider
                value={settings.maxTokens}
                min={256}
                max={32768}
                step={256}
                onValueChange={(v) => onUpdateSettings({ ...settings, maxTokens: Math.round(v) })}
                style={{ width: '100%' }}
              />
            </Box>
          </Box>
        </Section>

        {/* System Prompt */}
        <Section title="System Prompt">
          <TextInput
            value={settings.systemPrompt}
            onChangeText={(t) => onUpdateSettings({ ...settings, systemPrompt: t })}
            placeholder="You are a helpful assistant..."
            multiline
            style={{
              width: '100%',
              minHeight: 80,
              fontSize: 13,
              backgroundColor: V.bgInset,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: V.borderSubtle,
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 8, paddingBottom: 8,
              color: c.text,
              lineHeight: 1.5,
            }}
          />
        </Section>

        {/* Keyboard Shortcuts Reference */}
        <Section title="Keyboard Shortcuts">
          <Box style={{ gap: 6 }}>
            {[
              ['Ctrl+N', 'New conversation'],
              ['Ctrl+H', 'Toggle conversation history'],
              ['Ctrl+,', 'Open settings'],
              ['Ctrl+K', 'Command palette'],
              ['Escape', 'Close panels'],
            ].map(([key, desc], i) => (
              <Box key={i} style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, color: c.textSecondary }}>{desc}</Text>
                <Box style={{
                  paddingLeft: 8, paddingRight: 8,
                  paddingTop: 2, paddingBottom: 2,
                  borderRadius: 4,
                  backgroundColor: V.bgElevated,
                  borderWidth: 1,
                  borderColor: V.borderSubtle,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: c.textDim }}>
                    {key}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Section>
      </Box>
    </ScrollView>
  );
}
