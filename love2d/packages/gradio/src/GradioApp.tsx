/**
 * GradioApp — Renders a Gradio application from its server config.
 *
 * Point it at a running Gradio server and it renders the entire UI natively
 * in ReactJIT. No browser, no Svelte, no DOM. Just the protocol.
 *
 * Usage:
 *   <GradioApp url="http://localhost:7860" />
 */

import React, { useCallback } from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { useGradioClient } from './useGradioClient';
import { COMPONENT_MAP, LAYOUT_MAP, unsupported } from './component-map';
import type {
  GradioAppProps,
  GradioConfig,
  GradioLayoutNode,
  GradioComponentState,
  GradioDependency,
} from './types';

// ── Layout renderer ─────────────────────────────────────

interface LayoutRendererProps {
  node: GradioLayoutNode;
  config: GradioConfig;
  components: Map<number, GradioComponentState>;
  themeColors: Record<string, string>;
  overrides?: Record<string, React.ComponentType<any>>;
  onSetValue: (id: number, value: any) => void;
  onTrigger: (id: number, event: string) => void;
}

function LayoutNode({
  node,
  config,
  components,
  themeColors,
  overrides,
  onSetValue,
  onTrigger,
}: LayoutRendererProps) {
  // Find the component config for this node
  const compConfig = config.components.find(c => c.id === node.id);

  // If this is a layout node (has children), render as a flex container
  if (node.children && node.children.length > 0) {
    const layoutType = compConfig?.type ? LAYOUT_MAP[compConfig.type] : undefined;
    const direction = layoutType ?? 'column';

    // Tab handling — render tab labels + content
    if (compConfig?.type === 'tabs' || compConfig?.type === 'tab') {
      return (
        <Box style={{
          flexDirection: 'column',
          gap: 8,
          flexGrow: 1,
        }}>
          {node.children.map(child => (
            <LayoutNode
              key={child.id}
              node={child}
              config={config}
              components={components}
              themeColors={themeColors}
              overrides={overrides}
              onSetValue={onSetValue}
              onTrigger={onTrigger}
            />
          ))}
        </Box>
      );
    }

    return (
      <Box style={{
        flexDirection: direction as any,
        gap: 12,
        flexGrow: direction === 'row' ? 0 : undefined,
        ...(direction === 'row' ? { alignItems: 'flex-start' } : {}),
      }}>
        {node.children.map(child => (
          <LayoutNode
            key={child.id}
            node={child}
            config={config}
            components={components}
            themeColors={themeColors}
            overrides={overrides}
            onSetValue={onSetValue}
            onTrigger={onTrigger}
          />
        ))}
      </Box>
    );
  }

  // Leaf node — render the component
  const compState = components.get(node.id);
  if (!compState) return null;

  // Check for user override
  if (overrides && overrides[compState.type]) {
    const Override = overrides[compState.type];
    return (
      <Override
        state={compState}
        onChange={(value: any) => onSetValue(node.id, value)}
        onSubmit={() => onTrigger(node.id, 'click')}
        themeColors={themeColors}
      />
    );
  }

  // Look up the mapper
  const mapper = COMPONENT_MAP[compState.type] ?? unsupported;

  return mapper({
    state: compState,
    onChange: (value: any) => {
      onSetValue(node.id, value);
      // Check if this component has a "change" dependency
      onTrigger(node.id, 'change');
    },
    onSubmit: () => onTrigger(node.id, 'click'),
    themeColors,
  });
}

// ── Main component ──────────────────────────────────────

export function GradioApp({
  url,
  apiKey,
  sessionHash,
  onConfigLoaded,
  onPrediction,
  overrides,
}: GradioAppProps) {
  const colors = useThemeColors();
  const client = useGradioClient(url, {
    apiKey,
    sessionHash,
    onConfigLoaded,
    onPrediction,
  });

  const themeColors: Record<string, string> = {
    text: colors.text,
    bg: colors.bg,
    bgElevated: colors.bgElevated,
    surface: colors.surface,
    primary: colors.primary,
    border: colors.border,
    muted: colors.muted,
  };

  // Loading state
  if (client.loading) {
    return (
      <Box style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          {`Connecting to ${url}...`}
        </Text>
      </Box>
    );
  }

  // Error state
  if (client.error) {
    return (
      <Box style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}>
        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold' }}>
          {`Failed to connect to Gradio server`}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
          {client.error}
        </Text>
      </Box>
    );
  }

  // No config yet
  if (!client.config) return null;

  const title = client.config.title || client.config.description;

  return (
    <ScrollView style={{
      width: '100%',
      height: '100%',
      backgroundColor: colors.bg,
    }}>
      <Box style={{
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 20,
        paddingBottom: 20,
        gap: 16,
        maxWidth: 900,
      }}>
        {/* Title */}
        {title && (
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
            {title}
          </Text>
        )}

        {/* Description */}
        {client.config.description && client.config.title && (
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            {client.config.description}
          </Text>
        )}

        {/* Layout tree */}
        <LayoutNode
          node={client.config.layout}
          config={client.config}
          components={client.components}
          themeColors={themeColors}
          overrides={overrides}
          onSetValue={client.setValue}
          onTrigger={client.trigger}
        />
      </Box>
    </ScrollView>
  );
}
