import React, { useMemo } from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { evalComponent } from '../lib/eval-component';
import { C } from '../theme';
import type { SectionId } from './BentoLayout';

const PANEL_COLORS: Record<SectionId, string> = {
  A: C.panelA,
  B: C.panelB,
  C: C.panelC,
  D: C.panelD,
  E: C.panelE,
  F: C.panelF,
  G: C.panelG,
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: any },
  { hasError: boolean; message: string }
> {
  constructor(props: any) { super(props); this.state = { hasError: false, message: '' }; }
  static getDerivedStateFromError(e: any) { return { hasError: true, message: e?.message || String(e) }; }
  componentDidUpdate(prev: any) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }
  render() {
    if (this.state.hasError) return (
      <Box style={{ padding: 10 }}>
        <Text style={{ fontSize: 10, color: C.deny }}>{this.state.message}</Text>
      </Box>
    );
    return this.props.children;
  }
}

interface Props {
  id: SectionId;
  code?: string;
  children?: React.ReactNode;
  focused?: boolean;
  onPress?: () => void;
  label?: string;
}

export function Section({ id, code, children, focused, onPress, label }: Props) {
  const result = useMemo(() => code ? evalComponent(code) : null, [code]);
  const UserComponent = result?.component ?? null;
  const hasContent = !!children || !!UserComponent;

  return (
    <Pressable onPress={onPress} style={{ flexGrow: 1 }}>
    <Box style={{
      flexGrow: 1,
      backgroundColor: PANEL_COLORS[id],
      borderRadius: 6,
      borderWidth: focused ? 2 : 1,
      borderColor: focused ? C.accent : C.border,
      overflow: 'hidden',
    }}>
      {/* Panel label — always-on top-left corner tag */}
      {label && (
        <Box style={{
          position:        'absolute',
          top:             5,
          left:            7,
          zIndex:          10,
        }}>
          <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: 'bold', letterSpacing: 1 }}>
            {label}
          </Text>
        </Box>
      )}
      {/* Section label — visible when empty */}
      {!hasContent && (
        <Box style={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 20, color: '#ffffff12', fontWeight: 'bold' }}>{id}</Text>
        </Box>
      )}

      {/* Direct children — sandboxed so panel crashes don't kill the shell */}
      {children && id !== 'A' ? (
        <ErrorBoundary resetKey={children}>
          {children}
        </ErrorBoundary>
      ) : children}

      {/* Eval error */}
      {result?.error && (
        <Box style={{ padding: 8 }}>
          <Text style={{ fontSize: 10, color: C.deny }}>{result.error}</Text>
        </Box>
      )}

      {/* Live rendered component from eval */}
      {UserComponent && (
        <ErrorBoundary resetKey={UserComponent}>
          <UserComponent />
        </ErrorBoundary>
      )}
    </Box>
    </Pressable>
  );
}
