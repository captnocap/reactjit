/**
 * AIModelSelector — Select component wired to useModels().
 *
 * Fetches available models from the configured provider and
 * presents them in a dropdown. Calls onChange with the model ID.
 */

import React from 'react';
import { Box, Text, Select, type Style } from '@reactjit/core';
import { useModels } from '../hooks';
import type { AIConfig } from '../types';

export interface AIModelSelectorProps {
  /** Current selected model ID */
  value?: string;
  /** Called when a model is selected */
  onChange?: (modelId: string) => void;
  /** Provider config (overrides AIProvider context) */
  provider?: AIConfig['provider'];
  apiKey?: string;
  baseURL?: string;
  /** Label shown above the selector */
  label?: string;
  /** Container style */
  style?: Style;
}

export function AIModelSelector({
  value,
  onChange,
  provider,
  apiKey,
  baseURL,
  label = 'Model',
  style,
}: AIModelSelectorProps) {
  const { models, loading, error } = useModels({ provider, apiKey, baseURL });

  const options = models.map(m => ({
    value: m.id,
    label: m.name,
  }));

  return (
    <Box style={{ gap: 4, ...style }}>
      {label && (
        <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'bold' }}>
          {label}
        </Text>
      )}
      {loading ? (
        <Text style={{ fontSize: 12, color: '#475569' }}>Loading models...</Text>
      ) : error ? (
        <Text style={{ fontSize: 12, color: '#ef4444' }}>Failed to load models</Text>
      ) : (
        <Select
          options={options}
          value={value}
          onValueChange={onChange}
        />
      )}
    </Box>
  );
}
