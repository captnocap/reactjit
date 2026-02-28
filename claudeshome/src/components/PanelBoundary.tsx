import React from 'react';
import { Box, Text } from '@reactjit/core';
import { C } from '../theme';

interface Props {
  id: string;
  children: React.ReactNode;
}

interface State {
  error: string | null;
}

export class PanelBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(err: any) {
    return { error: String(err?.message ?? err) };
  }

  render() {
    if (this.state.error) {
      return (
        <Box style={{ flexGrow: 1, padding: 12, gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: C.deny, fontWeight: 'bold' }}>
            {`PANEL ${this.props.id} CRASHED`}
          </Text>
          <Text style={{ fontSize: 9, color: C.textMuted }}>
            {this.state.error.length > 120 ? this.state.error.slice(0, 120) + '...' : this.state.error}
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
