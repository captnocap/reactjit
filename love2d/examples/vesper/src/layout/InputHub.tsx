/**
 * InputHub — Multi-layer bottom panel for the chat view.
 *
 * Structure:
 *   ┌─────────────────────────────────────┐
 *   │ Row 1: Model selector + Token meter │
 *   ├─────────────────────────────────────┤
 *   │ Row 2: Context chips (if any)       │
 *   ├─────────────────────────────────────┤
 *   │ Row 3: AIChatInput + Stop button    │
 *   └─────────────────────────────────────┘
 */

import React from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { AIChatInput } from '@reactjit/ai';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { ProviderConfig } from '../types';
import type { ModelInfo } from '@reactjit/ai';

// ── Provider Badge ───────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  ollama:    V.ollama,
  openai:    V.openai,
  anthropic: V.anthropic,
};

function ProviderBadge({ provider }: { provider: ProviderConfig }) {
  const color = PROVIDER_COLORS[provider.id] || V.accent;
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 4,
      paddingBottom: 4,
      borderRadius: 4,
      backgroundColor: V.bgElevated,
      borderWidth: 1,
      borderColor: V.borderSubtle,
    }}>
      <Box style={{
        width: 6, height: 6,
        borderRadius: 9999,
        backgroundColor: provider.healthy ? V.success : V.error,
      }} />
      <Text style={{ fontSize: 11, fontWeight: '500', color }}>{provider.name}</Text>
    </Box>
  );
}

// ── Model Selector ───────────────────────────────────────

function ModelSelector({ model, models, onSelect }: {
  model: string;
  models: ModelInfo[];
  onSelect: (id: string) => void;
}) {
  const c = useThemeColors();
  const displayName = model || 'Select model...';

  // Simple pressable that cycles through models
  const handlePress = () => {
    if (models.length === 0) return;
    const idx = models.findIndex(m => m.id === model);
    const next = models[(idx + 1) % models.length];
    if (next) onSelect(next.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={(state) => ({
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 4,
        backgroundColor: state.hovered ? V.bgElevated : V.bgAlt,
        borderWidth: 1,
        borderColor: state.hovered ? V.borderStrong : V.borderSubtle,
      })}
    >
      <Text style={{ fontSize: 12, color: c.text, fontWeight: '500' }}>
        {displayName}
      </Text>
    </Pressable>
  );
}

// ── Token Meter ──────────────────────────────────────────

function TokenMeter({ count }: { count: number }) {
  const c = useThemeColors();
  if (count === 0) return null;
  const formatted = count > 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
  return (
    <Box style={{
      paddingLeft: 8, paddingRight: 8,
      paddingTop: 3, paddingBottom: 3,
      borderRadius: 4,
      backgroundColor: V.accentSubtle,
    }}>
      <Text style={{ fontSize: 10, color: V.accent, fontWeight: '500' }}>
        {`~${formatted} tokens`}
      </Text>
    </Box>
  );
}

// ── InputHub ─────────────────────────────────────────────

export interface InputHubProps {
  provider: ProviderConfig;
  model: string;
  models: ModelInfo[];
  onSelectModel: (id: string) => void;
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  onStop: () => void;
  tokenEstimate: number;
  contextFiles?: string[];
}

export function InputHub({
  provider,
  model,
  models,
  onSelectModel,
  send,
  isLoading,
  isStreaming,
  onStop,
  tokenEstimate,
  contextFiles,
}: InputHubProps) {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: V.bgAlt,
      borderTopWidth: 1,
      borderTopColor: V.border,
      gap: 0,
    }}>
      {/* Row 1: Provider + Model + Token Meter */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 4,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProviderBadge provider={provider} />
          <ModelSelector model={model} models={models} onSelect={onSelectModel} />
        </Box>
        <TokenMeter count={tokenEstimate} />
      </Box>

      {/* Row 2: Context chips (if any) */}
      {contextFiles && contextFiles.length > 0 && (
        <Box style={{
          width: '100%',
          flexDirection: 'row',
          gap: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
          {contextFiles.map((file, i) => (
            <Box key={i} style={{
              paddingLeft: 6, paddingRight: 6,
              paddingTop: 2, paddingBottom: 2,
              borderRadius: 4,
              backgroundColor: V.bgElevated,
              borderWidth: 1,
              borderColor: V.borderSubtle,
            }}>
              <Text style={{ fontSize: 10, color: V.textSecondary }}>
                {file}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Row 3: Chat input + Stop */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 4,
        paddingBottom: 10,
      }}>
        <Box style={{ flexGrow: 1 }}>
          <AIChatInput
            send={send}
            isLoading={isLoading}
            placeholder="Message Vesper..."
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
        {isStreaming && (
          <Pressable
            onPress={onStop}
            style={(state) => ({
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              backgroundColor: state.hovered ? V.error : 'rgba(239, 68, 68, 0.15)',
              borderWidth: 1,
              borderColor: V.error,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: V.error }}>
              Stop
            </Text>
          </Pressable>
        )}
      </Box>
    </Box>
  );
}
