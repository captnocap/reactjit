/**
 * AISettingsPanel — Combined model selector, temperature slider,
 * and system prompt editor wired to AIConfig state.
 */

import React from 'react';
import { Box, Text, Slider, TextInput, type Style } from '@reactjit/core';
import { AIModelSelector } from './AIModelSelector';
import type { AIConfig } from '../types';

export interface AISettingsPanelProps {
  /** Current config values */
  config: Partial<AIConfig>;
  /** Called when any config value changes */
  onChange: (patch: Partial<AIConfig>) => void;
  /** Which settings to show */
  show?: {
    model?: boolean;
    temperature?: boolean;
    maxTokens?: boolean;
    systemPrompt?: boolean;
  };
  /** Container style */
  style?: Style;
}

export function AISettingsPanel({
  config,
  onChange,
  show = { model: true, temperature: true, systemPrompt: true },
  style,
}: AISettingsPanelProps) {
  return (
    <Box style={{ gap: 16, padding: 12, ...style }}>
      {show.model !== false && (
        <AIModelSelector
          value={config.model}
          onChange={(model) => onChange({ model })}
          provider={config.provider}
          apiKey={config.apiKey}
          baseURL={config.baseURL}
        />
      )}

      {show.temperature !== false && (
        <Box style={{ gap: 4 }}>
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold' }}>
              Temperature
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              {(config.temperature ?? 1).toFixed(1)}
            </Text>
          </Box>
          <Slider
            value={config.temperature ?? 1}
            minimumValue={0}
            maximumValue={2}
            step={0.1}
            onValueChange={(temperature: number) => onChange({ temperature })}
          />
        </Box>
      )}

      {show.maxTokens !== false && (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold' }}>
            Max Tokens
          </Text>
          <TextInput
            value={config.maxTokens?.toString() || ''}
            onChangeText={(text) => {
              const n = parseInt(text, 10);
              if (!isNaN(n)) onChange({ maxTokens: n });
            }}
            placeholder="4096"
            placeholderColor="#475569"
            style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 8 }}
            textStyle={{ color: '#e2e8f0', fontSize: 13 }}
          />
        </Box>
      )}

      {show.systemPrompt !== false && (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold' }}>
            System Prompt
          </Text>
          <TextInput
            value={config.systemPrompt || ''}
            onChangeText={(systemPrompt) => onChange({ systemPrompt })}
            placeholder="You are a helpful assistant..."
            placeholderColor="#475569"
            multiline
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 6,
              padding: 8,
              minHeight: 60,
            }}
            textStyle={{ color: '#e2e8f0', fontSize: 13 }}
          />
        </Box>
      )}
    </Box>
  );
}
