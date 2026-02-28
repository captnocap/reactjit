/**
 * AIProvider — React context for default AI configuration.
 *
 * Wrap your app (or a subtree) to provide default API keys,
 * model selection, and provider settings to all useChat/useCompletion hooks.
 */

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AIConfig } from './types';

const AIContext = createContext<AIConfig | null>(null);

export interface AIProviderProps {
  config: AIConfig;
  children: ReactNode;
}

export function AIProvider({ config, children }: AIProviderProps) {
  return React.createElement(AIContext.Provider, { value: config }, children);
}

/**
 * Read the current AI configuration from context.
 * Returns null if no AIProvider is present (hooks handle this gracefully).
 */
export function useAIConfig(): AIConfig | null {
  return useContext(AIContext);
}
