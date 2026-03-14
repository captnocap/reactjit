/**
 * CompareView — Multi-model comparison mode.
 *
 * Send the same prompt to N providers simultaneously.
 * Responses render in equal-width columns side by side.
 * Each column is provider-branded with a glow header.
 */

import React, { useState } from 'react';
import {
  Box, Text, Pressable, ScrollView, Markdown, LoadingDots,
} from '@reactjit/core';
import { useChat } from '@reactjit/ai';
import { AIChatInput } from '@reactjit/ai';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { ProviderConfig, AppSettings } from '../types';

// ── Provider Colors ──────────────────────────────────────

const PROVIDER_GLOW: Record<string, string> = {
  ollama:    'rgba(255, 255, 255, 0.08)',
  openai:    'rgba(16, 163, 127, 0.12)',
  anthropic: 'rgba(217, 119, 87, 0.12)',
};

const PROVIDER_ACCENT: Record<string, string> = {
  ollama:    V.ollama,
  openai:    V.openai,
  anthropic: V.anthropic,
};

// ── Compare Column ───────────────────────────────────────

function CompareColumn({ provider, settings, sharedPrompt }: {
  provider: ProviderConfig;
  settings: AppSettings;
  sharedPrompt: string | null;
}) {
  const c = useThemeColors();
  const accent = PROVIDER_ACCENT[provider.id] || V.accent;
  const glow = PROVIDER_GLOW[provider.id] || V.accentSubtle;

  const chat = useChat({
    provider: provider.type,
    model: settings.activeModel || undefined,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    systemPrompt: settings.systemPrompt || undefined,
  });

  // Auto-send when shared prompt changes
  // rjit-ignore-next-line
  const lastSentRef = React.useRef<string | null>(null);
  if (sharedPrompt && sharedPrompt !== lastSentRef.current) {
    lastSentRef.current = sharedPrompt;
    chat.send(sharedPrompt);
  }

  const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
  const responseText = lastAssistant
    ? (typeof lastAssistant.content === 'string' ? lastAssistant.content : lastAssistant.content.map(b => b.text || '').join(''))
    : '';

  return (
    <Box style={{
      flexGrow: 1,
      flexBasis: 0,
      borderWidth: 1,
      borderColor: V.borderSubtle,
      borderRadius: 6,
      backgroundColor: V.bgAlt,
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Provider header */}
      <Box style={{
        width: '100%',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: glow,
        borderBottomWidth: 1,
        borderBottomColor: V.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Box style={{
            width: 6, height: 6,
            borderRadius: 9999,
            backgroundColor: provider.healthy ? V.success : V.error,
          }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: accent }}>
            {provider.name}
          </Text>
        </Box>
        {chat.isStreaming && (
          <Text style={{ fontSize: 10, color: V.textDim }}>
            streaming...
          </Text>
        )}
      </Box>

      {/* Response area */}
      <ScrollView style={{ flexGrow: 1, width: '100%' }}>
        <Box style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
        }}>
          {chat.isLoading && !responseText ? (
            <LoadingDots label="Thinking" color={accent} />
          ) : responseText ? (
            <Markdown content={responseText} style={{ fontSize: 13 }} />
          ) : (
            <Text style={{ fontSize: 12, color: V.textDim }}>
              Waiting for prompt...
            </Text>
          )}
          {chat.error && (
            <Box style={{
              paddingLeft: 8, paddingRight: 8,
              paddingTop: 6, paddingBottom: 6,
              borderRadius: 4,
              backgroundColor: 'rgba(239, 68, 68, 0.10)',
              borderLeftWidth: 2,
              borderLeftColor: V.error,
            }}>
              <Text style={{ fontSize: 11, color: V.error }}>
                {chat.error.message}
              </Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── CompareView ──────────────────────────────────────────

export interface CompareViewProps {
  providers: ProviderConfig[];
  settings: AppSettings;
}

export function CompareView({ providers, settings }: CompareViewProps) {
  const c = useThemeColors();
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    providers.slice(0, 2).map(p => p.id)
  );
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(p => p !== id) : prev  // keep at least 1
        : prev.length < 4 ? [...prev, id] : prev               // max 4
    );
  };

  const activeProviders = providers.filter(p => selectedProviders.includes(p.id));

  const handleSend = async (content: string) => {
    setSharedPrompt(content);
  };

  return (
    <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'column' }}>
      {/* Provider selector bar */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: V.border,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.textDim, paddingTop: 4 }}>
          Compare:
        </Text>
        {providers.map(p => {
          const selected = selectedProviders.includes(p.id);
          const accent = PROVIDER_ACCENT[p.id] || V.accent;
          return (
            <Pressable
              key={p.id}
              onPress={() => toggleProvider(p.id)}
              style={(state) => ({
                paddingLeft: 10, paddingRight: 10,
                paddingTop: 4, paddingBottom: 4,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: selected ? accent : V.borderSubtle,
                backgroundColor: selected
                  ? (PROVIDER_GLOW[p.id] || V.accentSubtle)
                  : state.hovered
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'transparent',
              })}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: selected ? '700' : '400',
                color: selected ? accent : c.textDim,
              }}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </Box>

      {/* Columns */}
      <Box style={{
        flexGrow: 1,
        width: '100%',
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        {activeProviders.map(p => (
          <CompareColumn
            key={p.id}
            provider={p}
            settings={settings}
            sharedPrompt={sharedPrompt}
          />
        ))}
      </Box>

      {/* Shared input */}
      <Box style={{
        width: '100%',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 4,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: V.border,
        backgroundColor: V.bgAlt,
      }}>
        <AIChatInput
          send={handleSend}
          isLoading={false}
          placeholder="Send to all selected providers..."
          sendColor={V.accent}
          autoFocus
          style={{
            backgroundColor: V.bgInset,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: V.border,
          }}
        />
      </Box>
    </Box>
  );
}
